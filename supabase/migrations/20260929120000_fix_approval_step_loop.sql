-- ============================================================
-- إصلاح حلقة تكرار إشعار الطلبات بعد الموافقة
-- السبب: current_approval_step يسقط على الافتراضي 0 بينما دالة
-- process_leave_approval الحية تقارن array_length > step (عدّ يبدأ من 1)
-- فترتد الموافقة الأولى إلى approval_chain[1] أي نفس المسؤول الذي وافق.
-- 1) تصحيح الدالة (معالجة الصفر القديم + حارس سلسلة المدير الواحد)
-- 2) الافتراضي الصحيح للعمود = 1 ومواءمة الصفوف المعلقة القديمة
-- 3) تنظيف إشعارات النظام التوأم الراكدة لطلبات معالجة بالكامل
-- ============================================================

CREATE OR REPLACE FUNCTION public.process_leave_approval(p_request_id uuid, p_action text)
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

            RETURN jsonb_build_object('success', true, 'status', 'approved');
        END IF;
    END IF;

    RETURN jsonb_build_object('success', false, 'message', 'إجراء غير معروف');
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$function$;

-- الافتراضي الصحيح: أول موافقة موجهة للمسؤول الأول = الخطوة 1
ALTER TABLE public.leave_requests
    ALTER COLUMN current_approval_step SET DEFAULT 1;

-- مواءمة الصفوف المعلقة القديمة التي سقطت على الصفر (طلبات جديدة بلا تعديلات)
UPDATE public.leave_requests
SET current_approval_step = 1
WHERE current_approval_step = 0
  AND status = 'pending'
  AND (modification_type IS NULL OR modification_type = '');

-- تنظيف إشعارات النظام التوأم (type=leave_request) لطلبات عولجت بالكامل
-- ولم تعد قيد المراجعة — كانت تبقى غير مقروءة وتُظهر الطلب مجدداً في الجرس
UPDATE public.system_notifications sn
SET is_read = true
WHERE sn.type = 'leave_request'
  AND sn.is_read = false
  AND sn.metadata ->> 'request_id' IS NOT NULL
  AND EXISTS (
      SELECT 1 FROM public.leave_requests lr
      WHERE lr.id = (sn.metadata ->> 'request_id')::uuid
        AND lr.status IN ('approved', 'rejected', 'canceled')
  );
-- ملاحظة: الطلبات المعلقة التي ارتدت على مسؤولها بفعل الحلقة (step=1 مع
-- supervisor=approval_chain[1]) لا تحتاج مواءمة — الدالة المصححة أعلاه تعالجها
-- تلقائياً: سلسلة المدير الواحد تُعتمد نهائياً، والسلاسل المتعددة تُصعَّد صحياً.
