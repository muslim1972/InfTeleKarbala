-- =========================================================================
-- V2 LEAVE SYSTEM MIGRATION SCRIPT (Idempotent State Machine)
-- =========================================================================

-- 1. DROP OLD TRIGGERS (Gatekeepers)
DROP TRIGGER IF EXISTS on_leave_request_approval ON public.leave_requests;
DROP TRIGGER IF EXISTS on_leave_request_cancellation ON public.leave_requests;
DROP TRIGGER IF EXISTS on_leave_request_rejection ON public.leave_requests;

-- 2. DROP OLD FUNCTIONS (Logic)
DROP FUNCTION IF EXISTS public.handle_leave_approval();
DROP FUNCTION IF EXISTS public.handle_leave_cancellation_refund();
DROP FUNCTION IF EXISTS public.handle_leave_rejection();

-- 3. ALTER LEAVE_REQUESTS TABLE (Add core structural columns)
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS job_number text,
ADD COLUMN IF NOT EXISTS leave_status text DEFAULT 'pending',          -- pending, approved, rejected
ADD COLUMN IF NOT EXISTS cancellation_status text DEFAULT 'none',      -- none, pending, approved, rejected
ADD COLUMN IF NOT EXISTS cut_status text DEFAULT 'none',               -- none, pending, approved, rejected
ADD COLUMN IF NOT EXISTS hr_cut_status text DEFAULT 'none',            -- none, pending, approved
ADD COLUMN IF NOT EXISTS hr_refunded_days integer DEFAULT 0;

-- 4. CREATE LEAVE_HISTORY TABLE (Audit Trail)
CREATE TABLE IF NOT EXISTS public.leave_history (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  leave_request_id uuid NOT NULL,
  action_type text NOT NULL,
  actor_id uuid,
  previous_balance integer,
  new_balance integer,
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT leave_history_pkey PRIMARY KEY (id),
  CONSTRAINT leave_history_request_id_fkey FOREIGN KEY (leave_request_id) REFERENCES public.leave_requests(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_leave_history_request_id ON public.leave_history USING btree (leave_request_id);

-- 5. THE UNIFIED STATE MACHINE FUNCTION
CREATE OR REPLACE FUNCTION public.handle_leave_state_machine()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_current_balance INTEGER;
    v_leave_year INTEGER;
    v_actor_id UUID;
    v_action_type TEXT := '';
    v_previous_balance INTEGER := 0;
    v_new_balance INTEGER := 0;
    v_leave_type TEXT := 'إجازة اعتيادية'; -- Default mapped globally
BEGIN
    -- Get the actor who made the change (the logged-in user)
    v_actor_id := auth.uid();
    
    -- Get current balance to log in history (used just for reference, not strict math deduction)
    SELECT COALESCE(remaining_leaves_balance, 0)
    INTO v_current_balance
    FROM public.financial_records
    WHERE user_id = NEW.user_id
    LIMIT 1;

    v_previous_balance := v_current_balance;

    -- =====================================================================
    -- RULE 1: NORMAL LEAVE APPROVAL (Deduction Phase)
    -- =====================================================================
    IF (NEW.leave_status = 'approved' AND OLD.leave_status IS DISTINCT FROM 'approved') AND NEW.is_deducted = FALSE THEN
        
        -- 1. Deduct balance from financial_records
        UPDATE public.financial_records
        SET remaining_leaves_balance = remaining_leaves_balance - NEW.days_count,
            last_modified_at = NOW()
        WHERE user_id = NEW.user_id;

        -- 2. Mark as DEDUCTED! (Idempotency Lock) 🔒
        NEW.is_deducted := TRUE;
        
        -- 3. Add record to leaves_details
        v_leave_year := CAST(EXTRACT(YEAR FROM NEW.start_date) AS INTEGER);
        INSERT INTO public.leaves_details (
            user_id, year, leave_type, start_date, end_date, duration, created_at
        ) VALUES (
            NEW.user_id, v_leave_year, v_leave_type, NEW.start_date, NEW.end_date, NEW.days_count, NOW()
        );

        -- 4. Update or Insert yearly_records (Stats)
        IF EXISTS (SELECT 1 FROM public.yearly_records WHERE user_id = NEW.user_id AND year = v_leave_year) THEN
            UPDATE public.yearly_records
            SET leaves_taken = COALESCE(leaves_taken, 0) + NEW.days_count,
                updated_at = NOW(),
                last_modified_at = NOW()
            WHERE user_id = NEW.user_id AND year = v_leave_year;
        ELSE
            INSERT INTO public.yearly_records (
                user_id, year, leaves_taken, sick_leaves, unpaid_leaves,
                updated_at, last_modified_at
            ) VALUES (
                NEW.user_id, v_leave_year, NEW.days_count, 0, 0,
                NOW(), NOW()
            );
        END IF;

        -- Prepare history log
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

        -- 2. Unlock deduction (Idempotency Release) 🔓
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

        -- Prepare history log
        v_action_type := 'cancellation_approved';
        v_new_balance := v_previous_balance + NEW.days_count;

    -- =====================================================================
    -- RULE 3: LATE REJECTION FOR DEDUCTED LEAVE (Fall-back Safety Refund)
    -- =====================================================================
    ELSIF (NEW.leave_status = 'rejected' AND OLD.leave_status IS DISTINCT FROM 'rejected') AND NEW.is_deducted = TRUE THEN
        
        -- 1. Refund the balance
        UPDATE public.financial_records
        SET remaining_leaves_balance = remaining_leaves_balance + NEW.days_count,
            last_modified_at = NOW()
        WHERE user_id = NEW.user_id;

        -- 2. Unlock deduction
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

        -- Prepare history log
        v_action_type := 'late_rejection_refund';
        v_new_balance := v_previous_balance + NEW.days_count;

    -- =====================================================================
    -- LOGGING ONLY PHASES (No deduction/refund, just changing states)
    -- =====================================================================
    ELSIF NEW.leave_status = 'rejected' AND OLD.leave_status IS DISTINCT FROM 'rejected' AND NEW.is_deducted = FALSE THEN
        v_action_type := 'leave_rejected';
        v_new_balance := v_previous_balance;
    ELSIF NEW.cancellation_status = 'pending' AND OLD.cancellation_status IS DISTINCT FROM 'pending' THEN
        v_action_type := 'cancellation_requested';
        v_new_balance := v_previous_balance;
    ELSIF NEW.cancellation_status = 'rejected' AND OLD.cancellation_status IS DISTINCT FROM 'rejected' THEN
        v_action_type := 'cancellation_rejected';
        v_new_balance := v_previous_balance;
    ELSIF NEW.cut_status = 'pending' AND OLD.cut_status IS DISTINCT FROM 'pending' THEN
        v_action_type := 'cut_requested';
        v_new_balance := v_previous_balance;
    ELSIF NEW.cut_status = 'approved' AND OLD.cut_status IS DISTINCT FROM 'approved' THEN
        v_action_type := 'cut_approved_by_manager';
        v_new_balance := v_previous_balance;
    ELSIF NEW.cut_status = 'rejected' AND OLD.cut_status IS DISTINCT FROM 'rejected' THEN
        v_action_type := 'cut_rejected_by_manager';
        v_new_balance := v_previous_balance;
    ELSIF NEW.hr_cut_status = 'approved' AND OLD.hr_cut_status IS DISTINCT FROM 'approved' THEN
        -- Notice: Balance is NOT updated here via trigger. A separate RPC function will handle HR cuts.
        v_action_type := 'cut_approved_by_hr';
        v_new_balance := v_previous_balance; 
    END IF;

    -- =====================================================================
    -- PERSIST HISTORY LOG
    -- =====================================================================
    IF v_action_type != '' THEN
        INSERT INTO public.leave_history (
            leave_request_id, action_type, actor_id, previous_balance, new_balance, notes
        ) VALUES (
            NEW.id, v_action_type, v_actor_id, v_previous_balance, v_new_balance, NEW.reason
        );
    END IF;

    -- =====================================================================
    -- BACKWARD COMPATIBILITY SYNC (Optional, to keep frontend happy until refactored)
    -- =====================================================================
    IF NEW.leave_status IS DISTINCT FROM OLD.leave_status THEN
        NEW.status := NEW.leave_status;
    END IF;

    -- Return the updated NEW row to be saved
    RETURN NEW;

EXCEPTION WHEN OTHERS THEN
    -- Provide verbose error strictly to logs instead of breaking silently
    RAISE LOG 'CRITICAL ERROR IN handle_leave_state_machine: %', SQLERRM;
    RETURN NEW; 
END;
$function$;

-- 6. ATTACH THE NEW STATE MACHINE TRIGGER
CREATE TRIGGER trg_leave_state_machine
BEFORE UPDATE ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.handle_leave_state_machine();

-- =========================================================================
-- 7. REFACTOR LEAVE SUBMISSION FUNCTION
-- =========================================================================
CREATE OR REPLACE FUNCTION public.submit_leave_request(p_start_date date, p_end_date date, p_days_count integer, p_reason text, p_supervisor_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_user_id UUID;
    v_job_number TEXT;
    v_current_balance INTEGER;
    v_request_id UUID;
    v_final_reason TEXT;
BEGIN
    -- Get current user ID
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Get job_number
    SELECT job_number INTO v_job_number FROM public.profiles WHERE id = v_user_id;

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
        job_number,
        start_date,
        end_date,
        days_count,
        reason,
        leave_status,
        status, -- For backward compatibility
        supervisor_id,
        is_deducted,
        modification_type
    ) VALUES (
        v_user_id,
        v_job_number,
        p_start_date,
        p_end_date,
        p_days_count,
        v_final_reason,
        'pending',
        'pending',
        p_supervisor_id,
        false,
        NULL
    )
    RETURNING id INTO v_request_id;

    -- Add to leave history
    INSERT INTO public.leave_history (
        leave_request_id, action_type, actor_id, previous_balance, new_balance, notes
    ) VALUES (
        v_request_id, 'leave_submitted', v_user_id, v_current_balance, v_current_balance, 'تقديم طلب إجازة جديد'
    );

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
$function$;


-- =========================================================================
-- 8. REFACTOR LEAVE MODIFICATION FUNCTION (Cancellation / Cut / Edit)
-- =========================================================================
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
