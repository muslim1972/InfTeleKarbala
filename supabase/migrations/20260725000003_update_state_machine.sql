-- Migration 3: update_state_machine
-- No single line arabic comments inside functions

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

    /* Skip balance deduction for certain types */
    IF NEW.leave_type IN ('dispatch', 'duty', 'sick', 'long_sick', 'time_off') THEN
        RETURN NEW;
    END IF;

    /* Get current balance */
    SELECT remaining_leaves_balance INTO v_previous_balance
    FROM public.financial_records WHERE user_id = NEW.user_id;

    IF v_previous_balance IS NULL THEN
        RAISE EXCEPTION 'No financial record found';
    END IF;

    v_paid_days := NEW.days_count - COALESCE(NEW.unpaid_days, 0);

    /* Rule 1: Approve Leave */
    IF (NEW.leave_status = 'approved' AND OLD.leave_status IS DISTINCT FROM 'approved') AND NEW.is_deducted = FALSE THEN
        
        UPDATE public.financial_records SET remaining_leaves_balance = remaining_leaves_balance - v_paid_days WHERE user_id = NEW.user_id;
        NEW.is_deducted := TRUE;
        v_leave_year := CAST(EXTRACT(YEAR FROM NEW.start_date) AS INTEGER);
        
        INSERT INTO public.leaves_details (user_id, year, leave_type, start_date, end_date, duration, created_at)
        VALUES (NEW.user_id, v_leave_year, NEW.leave_type, NEW.start_date, NEW.end_date, NEW.days_count, NOW());

        v_action_type := 'leave_approved';
        v_new_balance := v_previous_balance - v_paid_days;

    /* Rule 2: Approve Cancellation */
    ELSIF (NEW.cancellation_status = 'approved' AND OLD.cancellation_status IS DISTINCT FROM 'approved') AND NEW.is_deducted = TRUE THEN
        UPDATE public.financial_records SET remaining_leaves_balance = remaining_leaves_balance + v_paid_days WHERE user_id = NEW.user_id;
        NEW.is_deducted := FALSE;
        DELETE FROM public.leaves_details WHERE user_id = NEW.user_id AND start_date = NEW.start_date AND duration = NEW.days_count;
        
        v_action_type := 'cancellation_approved';
        v_new_balance := v_previous_balance + v_paid_days;

    /* Rule 3: Reject After Deduction */
    ELSIF (NEW.leave_status = 'rejected' AND OLD.leave_status IS DISTINCT FROM 'rejected') AND NEW.is_deducted = TRUE THEN
        UPDATE public.financial_records SET remaining_leaves_balance = remaining_leaves_balance + v_paid_days WHERE user_id = NEW.user_id;
        NEW.is_deducted := FALSE;
        DELETE FROM public.leaves_details WHERE user_id = NEW.user_id AND start_date = NEW.start_date AND duration = NEW.days_count;
        
        v_action_type := 'leave_rejected_after_deduction';
        v_new_balance := v_previous_balance + v_paid_days;

    /* Rule 4: Edit Refund */
    ELSIF (NEW.leave_status = 'pending' AND OLD.leave_status = 'approved') AND NEW.is_deducted = TRUE THEN
        UPDATE public.financial_records SET remaining_leaves_balance = remaining_leaves_balance + (OLD.days_count - COALESCE(OLD.unpaid_days, 0)) WHERE user_id = NEW.user_id;
        NEW.is_deducted := FALSE;
        DELETE FROM public.leaves_details WHERE user_id = NEW.user_id AND start_date = OLD.start_date AND duration = OLD.days_count;
        
        v_action_type := 'leave_edited_refund';
        v_new_balance := v_previous_balance + (OLD.days_count - COALESCE(OLD.unpaid_days, 0));
    END IF;

    /* Audit Trail */
    IF v_action_type IS NOT NULL THEN
        INSERT INTO public.leave_history (leave_request_id, action_type, previous_balance, new_balance, actor_id, created_at)
        VALUES (NEW.id, v_action_type, v_previous_balance, v_new_balance, auth.uid(), NOW());
    END IF;

    RETURN NEW;
END;
$$;
