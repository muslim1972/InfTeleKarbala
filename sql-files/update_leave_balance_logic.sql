-- 1. Restore submit_leave_request to NOT deduct balance (just checks)
CREATE OR REPLACE FUNCTION public.submit_leave_request(
    p_start_date DATE,
    p_end_date DATE,
    p_days_count INTEGER,
    p_reason TEXT,
    p_supervisor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_current_balance INTEGER;
    v_request_id UUID;
    v_final_reason TEXT;
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

    v_final_reason := p_reason;

    -- Check balance but DO NOT DEDUCT yet
    IF v_current_balance < p_days_count THEN
        v_final_reason := 'الرصيد لا يسمح.' || CHR(10) || p_reason;
    END IF;

    -- Insert request with supervisor_id
    INSERT INTO public.leave_requests (
        user_id,
        start_date,
        end_date,
        days_count,
        reason,
        status,
        supervisor_id
    ) VALUES (
        v_user_id,
        p_start_date,
        p_end_date,
        p_days_count,
        v_final_reason,
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


-- 2. Restore handle_leave_approval to DEDUCT balance ONLY when approved
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
            v_leave_type,
            NEW.start_date,
            NEW.end_date,
            NEW.days_count,
            NOW()
        );

        -- 3. Update yearly records stats
        UPDATE public.yearly_records
        SET leaves_taken = COALESCE(leaves_taken, 0) + NEW.days_count,
            last_modified_at = NOW()
        WHERE user_id = NEW.user_id AND year = v_leave_year;

    END IF;

    RETURN NEW;
END;
$function$;


-- 3. Create a NEW function and trigger for Refund on Cancellation
-- When modify_leave_request is called with 'canceled', it changes status to 'pending'
-- and modification_type to 'canceled'. 
-- We only refund if the OLD status was 'approved' because that's when it was actually deducted!
CREATE OR REPLACE FUNCTION public.handle_leave_cancellation_refund()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    -- Check if it's being canceled and it was previously approved
    IF NEW.modification_type = 'canceled' AND OLD.status = 'approved' THEN
        
        -- Refund the exact days that were previously approved
        UPDATE public.financial_records
        SET remaining_leaves_balance = remaining_leaves_balance + OLD.days_count,
            last_modified_at = NOW()
        WHERE user_id = NEW.user_id;

        -- We might also want to delete from leaves_details if it was canceled
        -- (Assuming one standard leave record matches the start_date and user_id)
        DELETE FROM public.leaves_details
        WHERE user_id = OLD.user_id 
          AND start_date = OLD.start_date 
          AND duration = OLD.days_count;

        -- Reverse the yearly_records stats
        UPDATE public.yearly_records
        SET leaves_taken = GREATEST(COALESCE(leaves_taken, 0) - OLD.days_count, 0),
            last_modified_at = NOW()
        WHERE user_id = OLD.user_id 
          AND year = EXTRACT(YEAR FROM OLD.start_date);

    END IF;

    RETURN NEW;
END;
$function$;

-- Create the trigger for cancellation refunds
DROP TRIGGER IF EXISTS on_leave_request_cancellation ON public.leave_requests;

CREATE TRIGGER on_leave_request_cancellation
AFTER UPDATE OF modification_type ON public.leave_requests
FOR EACH ROW
WHEN (NEW.modification_type = 'canceled' AND OLD.status = 'approved')
EXECUTE FUNCTION public.handle_leave_cancellation_refund();
