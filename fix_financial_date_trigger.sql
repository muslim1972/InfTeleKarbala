-- إصلاح عمود last_modified_at في جدول financial_records
-- بناءً على طلبك، هذا السكربت يمنع تحديث تاريخ last_modified_at عند الموافقة على الإجازات
-- بحيث يبقى التاريخ المذكور معتمداً فقط على تعديلات الراتب والمخصصات والاستقطاعات

CREATE OR REPLACE FUNCTION public.handle_leave_state_machine()
RETURNS trigger AS $$
DECLARE
    v_previous_balance INTEGER;
    v_new_balance INTEGER;
    v_leave_year INTEGER;
    v_action_type TEXT;
    v_leave_type TEXT;
    v_paid_days INTEGER;
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

    -- [NEW] Calculate paid days only (exclude unpaid days from balance operations)
    v_paid_days := NEW.days_count - COALESCE(NEW.unpaid_days, 0);

    -- =====================================================================
    -- RULE 1: NEW LEAVE APPROVAL (Deduction Phase)
    -- =====================================================================
    IF (NEW.leave_status = 'approved' AND OLD.leave_status IS DISTINCT FROM 'approved') AND NEW.is_deducted = FALSE THEN
        
        -- Deduct only PAID days from balance (removed last_modified_at update)
        UPDATE public.financial_records
        SET remaining_leaves_balance = remaining_leaves_balance - v_paid_days
        WHERE user_id = NEW.user_id;

        NEW.is_deducted := TRUE;
        
        v_leave_year := CAST(EXTRACT(YEAR FROM NEW.start_date) AS INTEGER);
        INSERT INTO public.leaves_details (
            user_id, year, leave_type, start_date, end_date, duration, created_at
        ) VALUES (
            NEW.user_id, v_leave_year, v_leave_type, NEW.start_date, NEW.end_date, NEW.days_count, NOW()
        );

        IF EXISTS (SELECT 1 FROM public.yearly_records WHERE user_id = NEW.user_id AND year = v_leave_year) THEN
            UPDATE public.yearly_records
            SET leaves_taken = COALESCE(leaves_taken, 0) + NEW.days_count,
                unpaid_leaves = COALESCE(unpaid_leaves, 0) + COALESCE(NEW.unpaid_days, 0),
                updated_at = NOW()
            WHERE user_id = NEW.user_id AND year = v_leave_year;
        ELSE
            INSERT INTO public.yearly_records (
                user_id, year, leaves_taken, sick_leaves, unpaid_leaves, updated_at, last_modified_at
            ) VALUES (
                NEW.user_id, v_leave_year, NEW.days_count, 0, COALESCE(NEW.unpaid_days, 0), NOW(), NOW()
            );
        END IF;

        v_action_type := 'leave_approved';
        v_new_balance := v_previous_balance - v_paid_days;

    -- =====================================================================
    -- RULE 2: CANCELLATION APPROVAL (Full Refund Phase)
    -- =====================================================================
    ELSIF (NEW.cancellation_status = 'approved' AND OLD.cancellation_status IS DISTINCT FROM 'approved') AND NEW.is_deducted = TRUE THEN
        
        -- Refund only the PAID portion (removed last_modified_at update)
        UPDATE public.financial_records
        SET remaining_leaves_balance = remaining_leaves_balance + v_paid_days
        WHERE user_id = NEW.user_id;

        NEW.is_deducted := FALSE;

        DELETE FROM public.leaves_details 
        WHERE user_id = NEW.user_id 
          AND start_date = NEW.start_date 
          AND duration = NEW.days_count;

        v_leave_year := CAST(EXTRACT(YEAR FROM NEW.start_date) AS INTEGER);
        UPDATE public.yearly_records
        SET leaves_taken = GREATEST(COALESCE(leaves_taken, 0) - NEW.days_count, 0),
            unpaid_leaves = GREATEST(COALESCE(unpaid_leaves, 0) - COALESCE(NEW.unpaid_days, 0), 0),
            updated_at = NOW()
        WHERE user_id = NEW.user_id AND year = v_leave_year;

        v_action_type := 'cancellation_approved';
        v_new_balance := v_previous_balance + v_paid_days;

    -- =====================================================================
    -- RULE 3: LATE REJECTION FOR DEDUCTED LEAVE (Fall-back Safety Refund)
    -- =====================================================================
    ELSIF (NEW.leave_status = 'rejected' AND OLD.leave_status IS DISTINCT FROM 'rejected') AND NEW.is_deducted = TRUE THEN
        
        -- Refund only paid portion (removed last_modified_at update)
        UPDATE public.financial_records
        SET remaining_leaves_balance = remaining_leaves_balance + v_paid_days
        WHERE user_id = NEW.user_id;

        NEW.is_deducted := FALSE;

        DELETE FROM public.leaves_details 
        WHERE user_id = NEW.user_id AND start_date = NEW.start_date AND duration = NEW.days_count;

        v_action_type := 'leave_rejected_after_deduction';
        v_new_balance := v_previous_balance + v_paid_days;

    END IF;

    -- =====================================================================
    -- LOG HISTORY 
    -- =====================================================================
    IF v_action_type IS NOT NULL THEN
        INSERT INTO public.leave_history (
            leave_request_id, action_type, previous_balance, new_balance, actor_id, created_at
        ) VALUES (
            NEW.id, v_action_type, v_previous_balance, v_new_balance, auth.uid(), NOW()
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
