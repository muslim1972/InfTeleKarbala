-- SQL function for HR to process a leave cut and refund days.
CREATE OR REPLACE FUNCTION public.process_hr_leave_cut(
    p_request_id uuid,
    p_actual_days integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_request RECORD;
    v_refund_days INTEGER;
    v_new_end_date DATE;
    v_previous_balance INTEGER;
    v_new_balance INTEGER;
    v_leave_year INTEGER;
BEGIN
    SELECT * INTO v_request 
    FROM public.leave_requests 
    WHERE id = p_request_id AND cut_status = 'approved' AND hr_cut_status = 'pending';

    IF v_request IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Request not found or not in correct state.');
    END IF;

    IF p_actual_days >= v_request.days_count THEN
        RETURN jsonb_build_object('success', false, 'message', 'يجب أن يكون عدد الأيام الفعلي أقل من أيام الإجازة الأصلية.');
    END IF;

    IF p_actual_days < 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'لا يمكن أن يكون عدد الأيام بالسالب.');
    END IF;

    v_refund_days := v_request.days_count - p_actual_days;
    
    -- If they came back on cut_date, the new end_date is cut_date - 1 day.
    IF v_request.cut_date IS NOT NULL THEN
        v_new_end_date := v_request.cut_date - INTERVAL '1 day';
    ELSE
        -- Fallback if cut_date is somehow null, calculate from start + actual days
        v_new_end_date := v_request.start_date + (p_actual_days - 1) * INTERVAL '1 day';
    END IF;
    
    IF p_actual_days = 0 THEN
        v_new_end_date := v_request.start_date; -- Just safe fallback
    END IF;

    -- Get balance
    SELECT remaining_leaves_balance INTO v_previous_balance
    FROM public.financial_records
    WHERE user_id = v_request.user_id;

    -- Update balance
    UPDATE public.financial_records
    SET remaining_leaves_balance = remaining_leaves_balance + v_refund_days,
        last_modified_at = NOW()
    WHERE user_id = v_request.user_id;

    v_new_balance := COALESCE(v_previous_balance, 0) + v_refund_days;

    -- Update Request
    UPDATE public.leave_requests
    SET 
        hr_cut_status = 'approved',
        days_count = p_actual_days,
        end_date = v_new_end_date
    WHERE id = p_request_id;

    -- Update Leaves details
    UPDATE public.leaves_details
    SET duration = p_actual_days, end_date = v_new_end_date
    WHERE user_id = v_request.user_id AND start_date = v_request.start_date AND duration = v_request.days_count;

    -- Update Yearly Records
    v_leave_year := CAST(EXTRACT(YEAR FROM v_request.start_date) AS INTEGER);
    UPDATE public.yearly_records
    SET leaves_taken = GREATEST(COALESCE(leaves_taken, 0) - v_refund_days, 0),
        updated_at = NOW(), last_modified_at = NOW()
    WHERE user_id = v_request.user_id AND year = v_leave_year;

    -- Log History
    INSERT INTO public.leave_history (leave_request_id, action_type, previous_balance, new_balance, actor_id, created_at)
    VALUES (p_request_id, 'hr_approved_cut', v_previous_balance, v_new_balance, auth.uid(), NOW());

    RETURN jsonb_build_object('success', true, 'message', 'تم تنفيذ قطع الإجازة بنجاح واسترداد ' || v_refund_days || ' يوم إلى رصيد الموظف.');
END;
$$;
