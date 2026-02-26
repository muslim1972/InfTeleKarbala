-- Function to submit a leave request with balance check AND supervisor
CREATE OR REPLACE FUNCTION public.submit_leave_request(
    p_start_date DATE,
    p_end_date DATE,
    p_days_count INTEGER,
    p_reason TEXT,
    p_supervisor_id UUID -- New parameter
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_current_balance INTEGER;
    v_request_id UUID;
BEGIN
    -- Get current user ID
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Check if days_count is valid
    IF p_days_count <= 0 THEN
        RAISE EXCEPTION 'Days count must be positive';
    END IF;

    -- Get current balance
    SELECT COALESCE(remaining_leaves_balance, 0)
    INTO v_current_balance
    FROM public.financial_records
    WHERE user_id = v_user_id
    LIMIT 1;

    -- Check balance
    IF v_current_balance < p_days_count THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'رصيد الإجازات غير كافٍ. الرصيد الحالي: ' || v_current_balance || ' يوم، المطلوب: ' || p_days_count || ' يوم.'
        );
    END IF;

    -- Insert request with supervisor_id
    INSERT INTO public.leave_requests (
        user_id,
        start_date,
        end_date,
        days_count,
        reason,
        status,
        supervisor_id -- Insert supervisor
    ) VALUES (
        v_user_id,
        p_start_date,
        p_end_date,
        p_days_count,
        p_reason,
        'pending',
        p_supervisor_id
    )
    RETURNING id INTO v_request_id;

    -- Return success
    RETURN jsonb_build_object(
        'success', true,
        'message', 'تم تقديم طلب الإجازة بنجاح، بانتظار موافقة المسؤول.',
        'request_id', v_request_id
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'message', 'حدث خطأ غير متوقع: ' || SQLERRM
    );
END;
$$;
