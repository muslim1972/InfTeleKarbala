-- Function to handle leave approval
CREATE OR REPLACE FUNCTION public.handle_leave_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_leave_year INTEGER;
    v_leave_type TEXT := 'إجازة اعتيادية'; -- Default type, could be dynamic if we add types to request
BEGIN
    -- Only proceed if status changed to 'approved'
    IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
        
        -- 1. Deduct from balance
        UPDATE public.financial_records
        SET remaining_leaves_balance = remaining_leaves_balance - NEW.days_count,
            last_modified_at = NOW()
        WHERE user_id = NEW.user_id;

        -- 2. Add to leaves_details history
        v_leave_year := EXTRACT(YEAR FROM NEW.start_date);
        
        INSERT INTO public.leaves_details (
            user_id,
            year,
            leave_type,
            start_date,
            end_date,
            duration,
            created_at
        ) VALUES (
            NEW.user_id,
            v_leave_year,
            v_leave_type, -- Currently defaulting to standard leave
            NEW.start_date,
            NEW.end_date,
            NEW.days_count,
            NOW()
        );

        -- 3. Update yearly records stats (optional, but good for consistency)
        UPDATE public.yearly_records
        SET leaves_taken = COALESCE(leaves_taken, 0) + NEW.days_count,
            last_modified_at = NOW()
        WHERE user_id = NEW.user_id AND year = v_leave_year;
        
        -- If yearly record doesn't exist, we might need to create it, but usually it exists.
        -- Keeping it simple for now.

    END IF;

    RETURN NEW;
END;
$$;

-- Drop trigger if exists to avoid duplication errors during re-runs
DROP TRIGGER IF EXISTS on_leave_request_approval ON public.leave_requests;

-- Create Trigger
CREATE TRIGGER on_leave_request_approval
AFTER UPDATE OF status ON public.leave_requests
FOR EACH ROW
WHEN (NEW.status = 'approved' AND OLD.status != 'approved')
EXECUTE FUNCTION public.handle_leave_approval();
