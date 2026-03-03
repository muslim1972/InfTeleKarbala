-- 1. Fixed modify_leave_request
CREATE OR REPLACE FUNCTION public.modify_leave_request(p_request_id uuid, p_modification_type text, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_days_count integer DEFAULT NULL::integer, p_cut_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
    v_request RECORD;
BEGIN
    -- Get current user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized. User not logged in.');
    END IF;

    -- Fetch request
    SELECT * INTO v_request 
    FROM public.leave_requests 
    WHERE id = p_request_id;

    IF v_request IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Request not found.');
    END IF;

    -- Check if user owns the request
    IF v_request.user_id != v_user_id THEN
         RETURN jsonb_build_object('success', false, 'message', 'Forbidden. Not your request.');
    END IF;

    -- Update based on modification type
    IF p_modification_type = 'canceled' THEN
        UPDATE public.leave_requests
        SET 
            cancellation_status = 'pending',
            modification_type = p_modification_type -- backwards compatibility
        WHERE id = p_request_id;
        
        RETURN jsonb_build_object('success', true, 'message', 'تم تقديم طلب إلغاء الإجازة بنجاح بانتظار موافقة المسؤول.');

    ELSIF p_modification_type = 'cut' THEN
        UPDATE public.leave_requests
        SET 
            cut_status = 'pending',
            cut_date = p_cut_date,
            modification_type = p_modification_type -- backwards compatibility
        WHERE id = p_request_id;
        
        RETURN jsonb_build_object('success', true, 'message', 'تم تقديم طلب قطع الإجازة بنجاح بانتظار موافقة المسؤول.');

    ELSIF p_modification_type = 'edited' THEN
        -- Only if it's still pending!
        IF v_request.leave_status != 'pending' THEN
             RETURN jsonb_build_object('success', false, 'message', 'لا يمكن تعديل طلب تمت معالجته مسبقاً.');
        END IF;

        UPDATE public.leave_requests
        SET 
            start_date = COALESCE(p_start_date, start_date),
            end_date = COALESCE(p_end_date, end_date),
            days_count = COALESCE(p_days_count, days_count),
            modification_type = p_modification_type
        WHERE id = p_request_id;

        RETURN jsonb_build_object('success', true, 'message', 'تم تعديل الطلب بنجاح.');
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'Invalid modification type.');
    END IF;

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$function$;

-- 2. Ensure Trigger logic properly catches ONLY cancellation approval (and doesn't re-deduct)
-- We'll replace the main trigger logic to be bulletproof regarding is_deducted.

CREATE OR REPLACE FUNCTION public.handle_leave_state_machine()
RETURNS trigger AS $$
DECLARE
    v_previous_balance INTEGER;
    v_new_balance INTEGER;
    v_leave_year INTEGER;
    v_action_type TEXT;
    v_leave_type TEXT;
BEGIN
    -- 1. Bypass if UI only touched 'is_read_by_employee'
    IF NEW.is_read_by_employee IS DISTINCT FROM OLD.is_read_by_employee 
       AND NEW.status = OLD.status
       AND NEW.leave_status = OLD.leave_status
       AND NEW.cancellation_status = OLD.cancellation_status
       AND NEW.cut_status = OLD.cut_status
    THEN
        RETURN NEW;
    END IF;

    -- 2. Fetch current balance
    SELECT remaining_leaves_balance INTO v_previous_balance
    FROM public.financial_records
    WHERE user_id = NEW.user_id;

    IF v_previous_balance IS NULL THEN
        RAISE EXCEPTION 'Financial record not found for user_id: %', NEW.user_id;
    END IF;

    -- Determine Type
    v_leave_type := 'normal';

    -- =====================================================================
    -- RULE 1: NEW LEAVE APPROVAL (Deduction Phase)
    -- =====================================================================
    IF (NEW.leave_status = 'approved' AND OLD.leave_status IS DISTINCT FROM 'approved') AND NEW.is_deducted = FALSE THEN
        
        -- 1. Deduct balance
        UPDATE public.financial_records
        SET remaining_leaves_balance = remaining_leaves_balance - NEW.days_count,
            last_modified_at = NOW()
        WHERE user_id = NEW.user_id;

        -- 2. Mark as DEDUCTED! 
        NEW.is_deducted := TRUE;
        
        -- 3. Add record to leaves_details
        v_leave_year := CAST(EXTRACT(YEAR FROM NEW.start_date) AS INTEGER);
        INSERT INTO public.leaves_details (
            user_id, year, leave_type, start_date, end_date, duration, created_at
        ) VALUES (
            NEW.user_id, v_leave_year, v_leave_type, NEW.start_date, NEW.end_date, NEW.days_count, NOW()
        );

        -- 4. Update stats
        IF EXISTS (SELECT 1 FROM public.yearly_records WHERE user_id = NEW.user_id AND year = v_leave_year) THEN
            UPDATE public.yearly_records
            SET leaves_taken = COALESCE(leaves_taken, 0) + NEW.days_count,
                updated_at = NOW(),
                last_modified_at = NOW()
            WHERE user_id = NEW.user_id AND year = v_leave_year;
        ELSE
            INSERT INTO public.yearly_records (
                user_id, year, leaves_taken, sick_leaves, unpaid_leaves, updated_at, last_modified_at
            ) VALUES (
                NEW.user_id, v_leave_year, NEW.days_count, 0, 0, NOW(), NOW()
            );
        END IF;

        v_action_type := 'leave_approved';
        v_new_balance := v_previous_balance - NEW.days_count;

    -- =====================================================================
    -- RULE 2: CANCELLATION APPROVAL (Full Refund Phase)
    -- =====================================================================
    ELSIF (NEW.cancellation_status = 'approved' AND OLD.cancellation_status IS DISTINCT FROM 'approved') AND NEW.is_deducted = TRUE THEN
        
        -- 1. Refund the exact balance
        UPDATE public.financial_records
        SET remaining_leaves_balance = remaining_leaves_balance + NEW.days_count,
            last_modified_at = NOW()
        WHERE user_id = NEW.user_id;

        -- 2. Unlock deduction (Idempotency Release)
        NEW.is_deducted := FALSE;

        -- 3. Remove from leaves_details history
        DELETE FROM public.leaves_details 
        WHERE user_id = NEW.user_id 
          AND start_date = NEW.start_date 
          AND duration = NEW.days_count;

        -- 4. Reverse yearly_records stats
        v_leave_year := CAST(EXTRACT(YEAR FROM NEW.start_date) AS INTEGER);
        UPDATE public.yearly_records
        SET leaves_taken = GREATEST(COALESCE(leaves_taken, 0) - NEW.days_count, 0),
            updated_at = NOW(),
            last_modified_at = NOW()
        WHERE user_id = NEW.user_id AND year = v_leave_year;

        v_action_type := 'cancellation_approved';
        v_new_balance := v_previous_balance + NEW.days_count;

    -- =====================================================================
    -- RULE 3: LATE REJECTION FOR DEDUCTED LEAVE (Fall-back Safety Refund)
    -- =====================================================================
    ELSIF (NEW.leave_status = 'rejected' AND OLD.leave_status IS DISTINCT FROM 'rejected') AND NEW.is_deducted = TRUE THEN
        
        -- Same as refund
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
        INSERT INTO public.leave_history (
            user_id, leave_request_id, action_type, previous_balance, new_balance, action_by, created_at
        ) VALUES (
            NEW.user_id, NEW.id, v_action_type, v_previous_balance, v_new_balance, auth.uid(), NOW()
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
