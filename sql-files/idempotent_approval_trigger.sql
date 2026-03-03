-- A strict idempotent version of handle_leave_approval
-- This prevents the "double deduction" bug entirely by checking if the request was already marked as processed 
-- inside the trigger logic itself.

-- 1. First, we need a small flag in leave_requests to ensure we only process approval once
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS is_deducted BOOLEAN DEFAULT FALSE;

-- 2. Update the trigger
CREATE OR REPLACE FUNCTION public.handle_leave_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_leave_year INTEGER;
    v_leave_type TEXT := 'إجازة اعتيادية'; -- Default type
BEGIN
    -- Only proceed if status changed to 'approved'
    IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
        
        -- NORMAL APPROVAL CASE (First time approval)
        IF (NEW.modification_type IS NULL OR NEW.modification_type = '') AND NEW.is_deducted = FALSE THEN
            
            -- 1. Deduct from balance
            UPDATE public.financial_records
            SET remaining_leaves_balance = remaining_leaves_balance - NEW.days_count,
                last_modified_at = NOW()
            WHERE user_id = NEW.user_id;

            -- Mark as deducted so it doesn't happen twice if the trigger fires again
            NEW.is_deducted := TRUE;
            
            -- 2. Add to leaves_details history
            v_leave_year := CAST(EXTRACT(YEAR FROM NEW.start_date) AS INTEGER);
            
            INSERT INTO public.leaves_details (
                user_id, year, leave_type, start_date, end_date, duration, created_at
            ) VALUES (
                NEW.user_id, v_leave_year, v_leave_type, NEW.start_date, NEW.end_date, NEW.days_count, NOW()
            );

            -- 3. Update OR Insert yearly records stats
            IF EXISTS (SELECT 1 FROM public.yearly_records WHERE user_id = NEW.user_id AND year = v_leave_year) THEN
                UPDATE public.yearly_records
                SET leaves_taken = COALESCE(leaves_taken, 0) + NEW.days_count,
                    last_modified_at = NOW()
                WHERE user_id = NEW.user_id AND year = v_leave_year;
            ELSE
                INSERT INTO public.yearly_records (
                    user_id, year, leaves_taken,
                    sick_leaves_taken, permissions_taken, delay_hours, delay_minutes,
                    created_at, last_modified_at
                ) VALUES (
                    NEW.user_id, v_leave_year, NEW.days_count,
                    0, 0, 0, 0, NOW(), NOW()
                );
            END IF;

        -- CANCELLATION APPROVAL CASE
        ELSIF NEW.modification_type = 'canceled' AND NEW.is_deducted = TRUE THEN
            
            -- 1. Refund the balance
            UPDATE public.financial_records
            SET remaining_leaves_balance = remaining_leaves_balance + NEW.days_count,
                last_modified_at = NOW()
            WHERE user_id = NEW.user_id;

            -- Mark as NOT deducted since we refunded it
            NEW.is_deducted := FALSE;

            -- 2. Remove from leaves_details history
            DELETE FROM public.leaves_details 
            WHERE user_id = NEW.user_id 
              AND start_date = NEW.start_date 
              AND duration = NEW.days_count;

            -- 3. Reverse yearly records stats
            v_leave_year := CAST(EXTRACT(YEAR FROM NEW.start_date) AS INTEGER);
            UPDATE public.yearly_records
            SET leaves_taken = GREATEST(COALESCE(leaves_taken, 0) - NEW.days_count, 0),
                last_modified_at = NOW()
            WHERE user_id = NEW.user_id AND year = v_leave_year;

        END IF;

    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'CRITICAL ERROR IN handle_leave_approval: %', SQLERRM;
    RETURN NEW;
END;
$function$;
