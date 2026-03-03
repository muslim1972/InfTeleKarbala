-- 1. Ensure uuid-ossp extension exists for uuid generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create the debug logging table
CREATE TABLE IF NOT EXISTS public.leave_trigger_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID,
    user_id UUID,
    log_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Update the handle_leave_approval trigger function with logging
CREATE OR REPLACE FUNCTION public.handle_leave_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_leave_year INTEGER;
    v_leave_type TEXT := 'إجازة اعتيادية'; -- Default type
    v_log_msg TEXT;
BEGIN
    -- Log start
    INSERT INTO public.leave_trigger_logs (request_id, user_id, log_message) 
    VALUES (NEW.id, NEW.user_id, 'Trigger fired. Old status: ' || OLD.status || ', New status: ' || NEW.status);

    -- Only proceed if status changed to 'approved'
    IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
        
        -- NORMAL APPROVAL CASE (First time approval)
        IF NEW.modification_type IS NULL OR NEW.modification_type = '' THEN
            
            INSERT INTO public.leave_trigger_logs (request_id, user_id, log_message) 
            VALUES (NEW.id, NEW.user_id, 'Normal approval. Attempting to deduct ' || NEW.days_count || ' days.');

            -- 1. Deduct from balance
            UPDATE public.financial_records
            SET remaining_leaves_balance = remaining_leaves_balance - NEW.days_count,
                last_modified_at = NOW()
            WHERE user_id = NEW.user_id;
            
            INSERT INTO public.leave_trigger_logs (request_id, user_id, log_message) 
            VALUES (NEW.id, NEW.user_id, 'Balance deducted. Attempting to update leaves_details.');

            -- 2. Add to leaves_details history
            v_leave_year := CAST(EXTRACT(YEAR FROM NEW.start_date) AS INTEGER);
            
            INSERT INTO public.leaves_details (
                user_id, year, leave_type, start_date, end_date, duration, created_at
            ) VALUES (
                NEW.user_id, v_leave_year, v_leave_type, NEW.start_date, NEW.end_date, NEW.days_count, NOW()
            );

            INSERT INTO public.leave_trigger_logs (request_id, user_id, log_message) 
            VALUES (NEW.id, NEW.user_id, 'leaves_details updated. Attempting to update yearly_records.');

            -- 3. Update OR Insert yearly records stats
            IF EXISTS (SELECT 1 FROM public.yearly_records WHERE user_id = NEW.user_id AND year = v_leave_year) THEN
                UPDATE public.yearly_records
                SET leaves_taken = COALESCE(leaves_taken, 0) + NEW.days_count,
                    last_modified_at = NOW()
                WHERE user_id = NEW.user_id AND year = v_leave_year;
                
                INSERT INTO public.leave_trigger_logs (request_id, user_id, log_message) 
                VALUES (NEW.id, NEW.user_id, 'yearly_records UPDATED successfully.');
            ELSE
                INSERT INTO public.yearly_records (
                    user_id, year, leaves_taken,
                    sick_leaves_taken, permissions_taken, delay_hours, delay_minutes,
                    created_at, last_modified_at
                ) VALUES (
                    NEW.user_id, v_leave_year, NEW.days_count,
                    0, 0, 0, 0, NOW(), NOW()
                );
                
                INSERT INTO public.leave_trigger_logs (request_id, user_id, log_message) 
                VALUES (NEW.id, NEW.user_id, 'yearly_records INSERTED successfully.');
            END IF;

        -- CANCELLATION APPROVAL CASE
        ELSIF NEW.modification_type = 'canceled' THEN
            
            INSERT INTO public.leave_trigger_logs (request_id, user_id, log_message) 
            VALUES (NEW.id, NEW.user_id, 'Cancellation approval. Attempting to refund ' || NEW.days_count || ' days.');

            -- 1. Refund the balance
            UPDATE public.financial_records
            SET remaining_leaves_balance = remaining_leaves_balance + NEW.days_count,
                last_modified_at = NOW()
            WHERE user_id = NEW.user_id;

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

            INSERT INTO public.leave_trigger_logs (request_id, user_id, log_message) 
            VALUES (NEW.id, NEW.user_id, 'Refund completed successfully.');
        END IF;

    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Capture the exact SQL error
    v_log_msg := 'CRITICAL ERROR: ' || SQLERRM;
    INSERT INTO public.leave_trigger_logs (request_id, user_id, log_message) 
    VALUES (NEW.id, NEW.user_id, v_log_msg);
    RETURN NEW;
END;
$function$;
