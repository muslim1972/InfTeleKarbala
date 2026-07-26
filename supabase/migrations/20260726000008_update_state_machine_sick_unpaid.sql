-- Migration 8: update_state_machine_sick_unpaid
-- Ensure the function handles sick leaves and unpaid accumulation correctly

CREATE OR REPLACE FUNCTION public.handle_leave_state_machine()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
    v_previous_balance INTEGER;
    v_new_balance INTEGER;
    v_leave_year INTEGER;
    v_action_type TEXT;
    v_paid_days INTEGER;
    v_unpaid_days INTEGER;
BEGIN
    /* Smart Guard */
    IF (NEW.leave_status = 'approved' AND OLD.leave_status IS DISTINCT FROM 'approved') 
       OR (NEW.cancellation_status = 'approved' AND OLD.cancellation_status IS DISTINCT FROM 'approved')
    THEN
        IF (auth.uid() != NEW.supervisor_id) AND (NOT public.is_privileged_user()) THEN
            RAISE EXCEPTION 'Unauthorized';
        END IF;
    END IF;

    /* Skip if no change in main statuses */
    IF NEW.status = OLD.status 
       AND NEW.leave_status = OLD.leave_status
       AND NEW.cancellation_status = OLD.cancellation_status 
       AND NEW.cut_status = OLD.cut_status
    THEN
        RETURN NEW;
    END IF;

    /* Skip entirely for types that don't affect balances or unpaid totals */
    IF NEW.leave_type IN ('dispatch', 'duty', 'time_off') THEN
        RETURN NEW;
    END IF;

    /* Get current balances */
    IF NEW.leave_type IN ('sick', 'long_sick') THEN
        SELECT sick_leaves_balance INTO v_previous_balance
        FROM public.financial_records WHERE user_id = NEW.user_id;
    ELSE
        SELECT remaining_leaves_balance INTO v_previous_balance
        FROM public.financial_records WHERE user_id = NEW.user_id;
    END IF;

    IF v_previous_balance IS NULL THEN
        RAISE EXCEPTION 'No financial record found';
    END IF;

    IF NEW.leave_type = 'unpaid' THEN
        v_paid_days := 0;
        v_unpaid_days := NEW.days_count;
    ELSE
        v_unpaid_days := COALESCE(NEW.unpaid_days, 0);
        v_paid_days := NEW.days_count - v_unpaid_days;
    END IF;

    /* Rule 1: Approve Leave */
    IF (NEW.leave_status = 'approved' AND OLD.leave_status IS DISTINCT FROM 'approved') AND NEW.is_deducted = FALSE THEN
        
        -- Deduct Paid Days
        IF NEW.leave_type IN ('sick', 'long_sick') THEN
            UPDATE public.financial_records SET sick_leaves_balance = sick_leaves_balance - v_paid_days WHERE user_id = NEW.user_id;
        ELSIF NEW.leave_type IN ('regular', 'long_regular') THEN
            UPDATE public.financial_records SET remaining_leaves_balance = remaining_leaves_balance - v_paid_days WHERE user_id = NEW.user_id;
        END IF;

        -- Accumulate Unpaid Days
        IF v_unpaid_days > 0 THEN
            UPDATE public.financial_records SET unpaid_leaves_total = COALESCE(unpaid_leaves_total, 0) + v_unpaid_days WHERE user_id = NEW.user_id;
        END IF;

        NEW.is_deducted := TRUE;
        v_leave_year := CAST(EXTRACT(YEAR FROM NEW.start_date) AS INTEGER);
        
        INSERT INTO public.leaves_details (user_id, year, leave_type, start_date, end_date, duration, created_at)
        VALUES (NEW.user_id, v_leave_year, NEW.leave_type, NEW.start_date, NEW.end_date, NEW.days_count, NOW());

        v_action_type := 'leave_approved';
        v_new_balance := v_previous_balance - v_paid_days;

    /* Rule 2: Approve Cancellation */
    ELSIF (NEW.cancellation_status = 'approved' AND OLD.cancellation_status IS DISTINCT FROM 'approved') AND NEW.is_deducted = TRUE THEN
        
        -- Refund Paid Days
        IF NEW.leave_type IN ('sick', 'long_sick') THEN
            UPDATE public.financial_records SET sick_leaves_balance = sick_leaves_balance + v_paid_days WHERE user_id = NEW.user_id;
        ELSIF NEW.leave_type IN ('regular', 'long_regular') THEN
            UPDATE public.financial_records SET remaining_leaves_balance = remaining_leaves_balance + v_paid_days WHERE user_id = NEW.user_id;
        END IF;

        -- Refund Unpaid Days
        IF v_unpaid_days > 0 THEN
            UPDATE public.financial_records SET unpaid_leaves_total = GREATEST(0, COALESCE(unpaid_leaves_total, 0) - v_unpaid_days) WHERE user_id = NEW.user_id;
        END IF;

        NEW.is_deducted := FALSE;
        DELETE FROM public.leaves_details WHERE user_id = NEW.user_id AND start_date = NEW.start_date AND duration = NEW.days_count;
        
        v_action_type := 'cancellation_approved';
        v_new_balance := v_previous_balance + v_paid_days;

    /* Rule 3: Reject After Deduction */
    ELSIF (NEW.leave_status = 'rejected' AND OLD.leave_status IS DISTINCT FROM 'rejected') AND NEW.is_deducted = TRUE THEN
        
        -- Refund Paid Days
        IF NEW.leave_type IN ('sick', 'long_sick') THEN
            UPDATE public.financial_records SET sick_leaves_balance = sick_leaves_balance + v_paid_days WHERE user_id = NEW.user_id;
        ELSIF NEW.leave_type IN ('regular', 'long_regular') THEN
            UPDATE public.financial_records SET remaining_leaves_balance = remaining_leaves_balance + v_paid_days WHERE user_id = NEW.user_id;
        END IF;

        -- Refund Unpaid Days
        IF v_unpaid_days > 0 THEN
            UPDATE public.financial_records SET unpaid_leaves_total = GREATEST(0, COALESCE(unpaid_leaves_total, 0) - v_unpaid_days) WHERE user_id = NEW.user_id;
        END IF;

        NEW.is_deducted := FALSE;
        DELETE FROM public.leaves_details WHERE user_id = NEW.user_id AND start_date = NEW.start_date AND duration = NEW.days_count;
        
        v_action_type := 'leave_rejected_after_deduction';
        v_new_balance := v_previous_balance + v_paid_days;

    /* Rule 4: Edit Refund */
    ELSIF (NEW.leave_status = 'pending' AND OLD.leave_status = 'approved') AND NEW.is_deducted = TRUE THEN
        
        DECLARE
            old_unpaid_days INTEGER;
            old_paid_days INTEGER;
        BEGIN
            IF OLD.leave_type = 'unpaid' THEN
                old_paid_days := 0;
                old_unpaid_days := OLD.days_count;
            ELSE
                old_unpaid_days := COALESCE(OLD.unpaid_days, 0);
                old_paid_days := OLD.days_count - old_unpaid_days;
            END IF;

            -- Refund Paid Days
            IF OLD.leave_type IN ('sick', 'long_sick') THEN
                UPDATE public.financial_records SET sick_leaves_balance = sick_leaves_balance + old_paid_days WHERE user_id = NEW.user_id;
            ELSIF OLD.leave_type IN ('regular', 'long_regular') THEN
                UPDATE public.financial_records SET remaining_leaves_balance = remaining_leaves_balance + old_paid_days WHERE user_id = NEW.user_id;
            END IF;

            -- Refund Unpaid Days
            IF old_unpaid_days > 0 THEN
                UPDATE public.financial_records SET unpaid_leaves_total = GREATEST(0, COALESCE(unpaid_leaves_total, 0) - old_unpaid_days) WHERE user_id = NEW.user_id;
            END IF;

            NEW.is_deducted := FALSE;
            DELETE FROM public.leaves_details WHERE user_id = NEW.user_id AND start_date = OLD.start_date AND duration = OLD.days_count;
            
            v_action_type := 'leave_edited_refund';
            v_new_balance := v_previous_balance + old_paid_days;
        END;
    END IF;

    /* Audit Trail */
    IF v_action_type IS NOT NULL THEN
        INSERT INTO public.leave_history (leave_request_id, action_type, previous_balance, new_balance, actor_id, created_at)
        VALUES (NEW.id, v_action_type, v_previous_balance, v_new_balance, auth.uid(), NOW());
    END IF;

    RETURN NEW;
END;
$$;
