CREATE OR REPLACE FUNCTION public.process_leave_approval(
    p_request_id uuid,
    p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_request record;
    v_current_step integer;
    v_chain_length integer;
    v_next_supervisor uuid;
BEGIN
    -- 1. Fetch the request
    SELECT * INTO v_request
    FROM public.leave_requests
    WHERE id = p_request_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'الطلب غير موجود');
    END IF;

    -- Security check (already handled by triggers, but good to have here)
    IF v_request.supervisor_id != auth.uid() AND NOT public.is_privileged_user() THEN
        RETURN jsonb_build_object('success', false, 'message', 'غير مصرح لك بالموافقة على هذا الطلب');
    END IF;

    -- 2. Handle rejection (immediate stop)
    IF p_action = 'rejected' THEN
        UPDATE public.leave_requests
        SET status = 'rejected',
            leave_status = 'rejected',
            is_read_by_employee = false
        WHERE id = p_request_id;
        
        RETURN jsonb_build_object('success', true, 'status', 'rejected');
    END IF;

    -- 3. Handle Approval
    IF p_action = 'approved' THEN
        v_current_step := COALESCE(v_request.current_approval_step, 1);
        v_chain_length := array_length(v_request.approval_chain, 1);

        IF v_chain_length IS NOT NULL AND v_current_step < v_chain_length THEN
            -- Escalate to next manager
            v_next_supervisor := v_request.approval_chain[v_current_step + 1];
            
            UPDATE public.leave_requests
            SET current_approval_step = v_current_step + 1,
                supervisor_id = v_next_supervisor
            WHERE id = p_request_id;

            RETURN jsonb_build_object('success', true, 'status', 'escalated', 'next_supervisor', v_next_supervisor);
        ELSE
            -- Final approval
            UPDATE public.leave_requests
            SET status = 'approved',
                leave_status = 'approved',
                is_read_by_employee = false
            WHERE id = p_request_id;

            RETURN jsonb_build_object('success', true, 'status', 'approved');
        END IF;
    END IF;

    RETURN jsonb_build_object('success', false, 'message', 'إجراء غير معروف');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;
