CREATE OR REPLACE FUNCTION public.process_leave_cancellation(p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_request RECORD;
    v_previous_balance INTEGER;
    v_new_balance INTEGER;
    v_leave_year INTEGER;
BEGIN
    -- 1. Get the request (must be approved originally, and requested cancellation)
    SELECT * INTO v_request 
    FROM public.leave_requests 
    WHERE id = p_request_id AND cancellation_status = 'pending';

    IF v_request IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'لم يتم العثور على طلب الإلغاء أو أنه تمت معالجته بالفعل.');
    END IF;

    -- 2. Get current balance
    SELECT remaining_leaves_balance INTO v_previous_balance
    FROM public.financial_records
    WHERE user_id = v_request.user_id;

    -- 3. Refund full days count
    UPDATE public.financial_records
    SET remaining_leaves_balance = remaining_leaves_balance + v_request.days_count,
        last_modified_at = NOW()
    WHERE user_id = v_request.user_id;

    v_new_balance := COALESCE(v_previous_balance, 0) + v_request.days_count;

    -- 4. Update the request status
    UPDATE public.leave_requests
    SET 
        cancellation_status = 'approved',
        status = 'canceled', -- Mark the whole request as canceled
        leave_status = 'canceled'
    WHERE id = p_request_id;

    -- 5. Delete or update Leaves details (we will delete it since it's fully canceled)
    DELETE FROM public.leaves_details
    WHERE user_id = v_request.user_id AND start_date = v_request.start_date AND duration = v_request.days_count;

    -- 6. Revert Yearly Records
    v_leave_year := CAST(EXTRACT(YEAR FROM v_request.start_date) AS INTEGER);
    UPDATE public.yearly_records
    SET leaves_taken = GREATEST(COALESCE(leaves_taken, 0) - v_request.days_count, 0),
        updated_at = NOW(), last_modified_at = NOW()
    WHERE user_id = v_request.user_id AND year = v_leave_year;

    -- 7. Log History
    INSERT INTO public.leave_history (leave_request_id, action_type, previous_balance, new_balance, actor_id, created_at)
    VALUES (p_request_id, 'leave_canceled', v_previous_balance, v_new_balance, auth.uid(), NOW());

    RETURN jsonb_build_object('success', true, 'message', 'تم الغاء الإجازة بنجاح واسترداد ' || v_request.days_count || ' يوم إلى رصيد الموظف.');
END;
$function$;
