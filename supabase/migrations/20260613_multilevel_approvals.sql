-- 1. إضافة أعمدة سلسلة الموافقات
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS approval_chain UUID[] DEFAULT '{}'::UUID[],
ADD COLUMN IF NOT EXISTS current_approval_step INTEGER DEFAULT 0;

-- 2. تعديل دالة الإرسال لتستقبل السلسلة
CREATE OR REPLACE FUNCTION submit_leave_request(
    p_user_id UUID,
    p_supervisor_id UUID,
    p_start_date DATE,
    p_end_date DATE,
    p_days_count INTEGER,
    p_leave_reason TEXT,
    p_status TEXT,
    p_approval_chain UUID[] DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_request_id UUID;
    v_actual_supervisor UUID;
BEGIN
    -- إذا تم إرسال سلسلة موافقات، اجعل المسؤول الحالي هو أول شخص في السلسلة
    IF p_approval_chain IS NOT NULL AND array_length(p_approval_chain, 1) > 0 THEN
        v_actual_supervisor := p_approval_chain[1];
    ELSE
        v_actual_supervisor := p_supervisor_id;
    END IF;

    -- إدخال الطلب
    INSERT INTO public.leave_requests (
        user_id,
        supervisor_id,
        start_date,
        end_date,
        days_count,
        reason,
        status,
        approval_chain,
        current_approval_step
    ) VALUES (
        p_user_id,
        v_actual_supervisor,
        p_start_date,
        p_end_date,
        p_days_count,
        p_leave_reason,
        p_status,
        COALESCE(p_approval_chain, '{}'::UUID[]),
        1 -- Array index starts at 1 in postgres
    ) RETURNING id INTO v_request_id;

    RETURN jsonb_build_object('success', true, 'request_id', v_request_id);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. دالة معالجة الموافقات بشكل تسلسلي
CREATE OR REPLACE FUNCTION process_leave_approval(
    p_request_id UUID,
    p_action TEXT -- 'approved' or 'rejected'
)
RETURNS JSONB AS $$
DECLARE
    v_request RECORD;
    v_next_supervisor UUID;
BEGIN
    SELECT * INTO v_request FROM public.leave_requests WHERE id = p_request_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Request not found');
    END IF;

    IF p_action = 'rejected' THEN
        -- الرفض من أي مدير يعني رفض الطلب بالكامل فوراً
        UPDATE public.leave_requests
        SET status = 'rejected_manager'
        WHERE id = p_request_id;
        
        RETURN jsonb_build_object('success', true, 'status', 'rejected_manager');
    END IF;

    IF p_action = 'approved' THEN
        -- التحقق مما إذا كان هناك مدير آخر في السلسلة يجب أن يوافق
        IF v_request.approval_chain IS NOT NULL AND array_length(v_request.approval_chain, 1) > v_request.current_approval_step THEN
            -- تمرير الطلب للمدير الذي يليه في السلسلة
            v_next_supervisor := v_request.approval_chain[v_request.current_approval_step + 1];
            
            UPDATE public.leave_requests
            SET supervisor_id = v_next_supervisor,
                current_approval_step = current_approval_step + 1
            WHERE id = p_request_id;

            RETURN jsonb_build_object('success', true, 'status', 'escalated');
        ELSE
            -- لا يوجد مدراء آخرون، الطلب معتمد نهائياً
            UPDATE public.leave_requests
            SET status = 'approved_manager'
            WHERE id = p_request_id;
            
            RETURN jsonb_build_object('success', true, 'status', 'approved_manager');
        END IF;
    END IF;

    RETURN jsonb_build_object('success', false, 'message', 'Invalid action');
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
