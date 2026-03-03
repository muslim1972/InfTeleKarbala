-- V3 FINAL LEAVE STATE MACHINE
-- This script completely replaces all previous leave approval/cancellation logic.

-- 1. Ensure required columns exist
DO $$
BEGIN
    ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS is_deducted BOOLEAN DEFAULT FALSE;
END $$;

-- 2. Drop EVERYTHING old to ensure a clean slate
DROP TRIGGER IF EXISTS leave_request_status_update ON public.leave_requests;
DROP TRIGGER IF EXISTS handle_leave_approval ON public.leave_requests;
DROP TRIGGER IF EXISTS trigger_handle_leave_state ON public.leave_requests;
DROP TRIGGER IF EXISTS leave_state_machine_trigger ON public.leave_requests;

-- Safely drop any other triggers if they exist
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tgname
        FROM pg_trigger
        WHERE tgrelid = 'public.leave_requests'::regclass 
          AND tgisinternal = false
          AND tgname NOT LIKE 'TRG%' -- don't drop history/sync triggers if any
          AND tgname != 'leave_state_machine_trigger'
    ) LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.tgname) || ' ON public.leave_requests';
    END LOOP;
END;
$$;

-- 3. Create the Main State Machine Function
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
    v_leave_type TEXT := 'normal';
BEGIN
    -- Bypass if only read status changed (notification clicked)
    IF NEW.is_read_by_employee IS DISTINCT FROM OLD.is_read_by_employee 
       AND NEW.status = OLD.status
       AND NEW.leave_status = OLD.leave_status
       AND NEW.cancellation_status = OLD.cancellation_status
       AND NEW.cut_status = OLD.cut_status
    THEN
        RETURN NEW;
    END IF;

    -- Fetch current balance
    SELECT remaining_leaves_balance INTO v_previous_balance
    FROM public.financial_records
    WHERE user_id = NEW.user_id;

    IF v_previous_balance IS NULL THEN
        -- Fallback if financial record doesn't exist yet for some reason
        v_previous_balance := 0; 
    END IF;

    -- =====================================================================
    -- RULE 1: NEW LEAVE APPROVAL (Deduction Phase)
    -- =====================================================================
    IF ((NEW.leave_status = 'approved' AND OLD.leave_status IS DISTINCT FROM 'approved') OR 
        (NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved')) 
       AND NEW.is_deducted = FALSE 
       -- Prevent triggering if approving a cancellation via 'status' column directly
       AND (NEW.cancellation_status IS DISTINCT FROM 'approved' AND NEW.modification_type IS DISTINCT FROM 'canceled')
    THEN
        
        -- Deduct balance
        UPDATE public.financial_records
        SET remaining_leaves_balance = remaining_leaves_balance - NEW.days_count,
            last_modified_at = NOW()
        WHERE user_id = NEW.user_id;

        NEW.is_deducted := TRUE;
        
        v_leave_year := CAST(EXTRACT(YEAR FROM NEW.start_date) AS INTEGER);
        INSERT INTO public.leaves_details (user_id, year, leave_type, start_date, end_date, duration, created_at) 
        VALUES (NEW.user_id, v_leave_year, v_leave_type, NEW.start_date, NEW.end_date, NEW.days_count, NOW());

        IF EXISTS (SELECT 1 FROM public.yearly_records WHERE user_id = NEW.user_id AND year = v_leave_year) THEN
            UPDATE public.yearly_records
            SET leaves_taken = COALESCE(leaves_taken, 0) + NEW.days_count, updated_at = NOW(), last_modified_at = NOW()
            WHERE user_id = NEW.user_id AND year = v_leave_year;
        ELSE
            INSERT INTO public.yearly_records (user_id, year, leaves_taken, sick_leaves, unpaid_leaves, updated_at, last_modified_at) 
            VALUES (NEW.user_id, v_leave_year, NEW.days_count, 0, 0, NOW(), NOW());
        END IF;

        v_action_type := 'leave_approved';
        v_new_balance := v_previous_balance - NEW.days_count;

    -- =====================================================================
    -- RULE 2: CANCELLATION APPROVAL (Refund Phase)
    -- =====================================================================
    ELSIF ((NEW.cancellation_status = 'approved' AND OLD.cancellation_status IS DISTINCT FROM 'approved') OR 
           (NEW.modification_type = 'canceled' AND NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved')) 
          AND NEW.is_deducted = TRUE THEN
        
        -- Refund balance
        UPDATE public.financial_records
        SET remaining_leaves_balance = remaining_leaves_balance + NEW.days_count,
            last_modified_at = NOW()
        WHERE user_id = NEW.user_id;

        NEW.is_deducted := FALSE;
        -- Also flag main status to canceled so the UI understands it explicitly
        NEW.leave_status := 'canceled';
        NEW.status := 'canceled';

        DELETE FROM public.leaves_details 
        WHERE user_id = NEW.user_id AND start_date = NEW.start_date AND duration = NEW.days_count;

        v_leave_year := CAST(EXTRACT(YEAR FROM NEW.start_date) AS INTEGER);
        UPDATE public.yearly_records
        SET leaves_taken = GREATEST(COALESCE(leaves_taken, 0) - NEW.days_count, 0), updated_at = NOW(), last_modified_at = NOW()
        WHERE user_id = NEW.user_id AND year = v_leave_year;

        v_action_type := 'cancellation_approved';
        v_new_balance := v_previous_balance + NEW.days_count;

    -- =====================================================================
    -- RULE 3: REJECTION FOR PREVIOUSLY DEDUCTED LEAVE (Safety Refund)
    -- =====================================================================
    ELSIF ((NEW.leave_status = 'rejected' AND OLD.leave_status IS DISTINCT FROM 'rejected') OR 
           (NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected')) 
          AND NEW.is_deducted = TRUE THEN
        
        -- Refund
        UPDATE public.financial_records
        SET remaining_leaves_balance = remaining_leaves_balance + NEW.days_count, last_modified_at = NOW()
        WHERE user_id = NEW.user_id;

        NEW.is_deducted := FALSE;

        DELETE FROM public.leaves_details 
        WHERE user_id = NEW.user_id AND start_date = NEW.start_date AND duration = NEW.days_count;

        v_action_type := 'leave_rejected_after_deduction';
        v_new_balance := v_previous_balance + NEW.days_count;

    END IF;

    -- =====================================================================
    -- LOG HISTORY (Only if an action was taken)
    -- =====================================================================
    IF v_action_type IS NOT NULL THEN
        INSERT INTO public.leave_history (leave_request_id, action_type, previous_balance, new_balance, actor_id, created_at) 
        VALUES (NEW.id, v_action_type, v_previous_balance, v_new_balance, auth.uid(), NOW());
    END IF;

    RETURN NEW;
END;
$$;

-- 4. ATTACH THE TRIGGER (THIS IS THE MISSING PIECE!)
CREATE TRIGGER leave_state_machine_trigger
BEFORE UPDATE ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.handle_leave_state_machine();
