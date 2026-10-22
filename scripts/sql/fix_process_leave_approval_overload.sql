-- إسقاط دوال الموافقة المتضاربة (Overload Conflict)
DROP FUNCTION IF EXISTS public.process_leave_approval(uuid, text, text);
DROP FUNCTION IF EXISTS public.process_leave_approval(uuid, text);

-- إنشاء الدالة الموحدة الوحيدة لمعالجة الموافقات والتصعيد الهرمي
CREATE OR REPLACE FUNCTION public.process_leave_approval(
    p_request_id uuid,
    p_action text,
    p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_request RECORD;
    v_step INTEGER;
    v_chain_len INTEGER;
    v_next_supervisor UUID;
BEGIN
    SELECT * INTO v_request FROM public.leave_requests WHERE id = p_request_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'الطلب غير موجود');
    END IF;

    -- حارس الصلاحية: المسؤول الحالي أو مستخدم متميز فقط
    IF v_request.supervisor_id IS DISTINCT FROM auth.uid() AND NOT public.is_privileged_user() THEN
        RETURN jsonb_build_object('success', false, 'message', 'غير مصرح لك بالموافقة على هذا الطلب');
    END IF;

    IF p_action = 'rejected' THEN
        UPDATE public.leave_requests
        SET status = 'rejected',
            leave_status = 'rejected',
            is_read_by_employee = false
        WHERE id = p_request_id;

        -- إشعار صاحب الطلب وتسوية إشعارات المسؤولين
        BEGIN
            PERFORM public.core_settle_request_approval(p_request_id, auth.uid(), 'rejected', p_notes);
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;

        RETURN jsonb_build_object('success', true, 'status', 'rejected');
    END IF;

    IF p_action = 'approved' THEN
        -- الخطوة بعدّ يبدأ من 1 (أول مسؤول = approval_chain[1])
        -- الصفر إرث قديم من الافتراضي السابق فيُعامَل كـ 1
        v_step := GREATEST(COALESCE(v_request.current_approval_step, 0), 0);
        IF v_step = 0 THEN v_step := 1; END IF;
        v_chain_len := COALESCE(array_length(v_request.approval_chain, 1), 0);

        IF v_chain_len > 1 AND v_step < v_chain_len THEN
            -- سلسلة متعددة: تصعيد إلى المدير التالي
            v_next_supervisor := v_request.approval_chain[v_step + 1];

            UPDATE public.leave_requests
            SET current_approval_step = v_step + 1,
                supervisor_id = v_next_supervisor
            WHERE id = p_request_id;

            RETURN jsonb_build_object('success', true, 'status', 'escalated', 'next_supervisor', v_next_supervisor);
        ELSE
            -- مدير واحد (أو نهاية السلسلة): اعتماد نهائي
            UPDATE public.leave_requests
            SET status = 'approved',
                leave_status = 'approved',
                is_read_by_employee = false
            WHERE id = p_request_id;

            -- إشعار صاحب الطلب وتسوية إشعارات المسؤولين و HR والبصمة
            BEGIN
                PERFORM public.core_settle_request_approval(p_request_id, auth.uid(), 'approved', p_notes);
            EXCEPTION WHEN OTHERS THEN
                NULL;
            END;

            RETURN jsonb_build_object('success', true, 'status', 'approved');
        END IF;
    END IF;

    RETURN jsonb_build_object('success', false, 'message', 'إجراء غير معروف');
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$function$;

REVOKE ALL ON FUNCTION public.process_leave_approval(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_leave_approval(uuid, text, text) TO authenticated;
