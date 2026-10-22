-- ============================================================
-- BE-LEV-01: تمكين ماكينة حالات الإجازات من معالجة INSERT المعتمد مباشرة
-- يضمن خصم رصيد الإجازات تلقائياً عند إدراج إجازات إجبارية معتمدة من النظام
-- مع توثيق الأرشيف عبر AFTER INSERT trigger لتفادي خطأ المفتاح الأجنبي
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_leave_state_machine()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_previous_balance INTEGER;
    v_new_balance INTEGER;
    v_leave_year INTEGER;
    v_action_type TEXT;
    v_paid_days INTEGER;
    v_unpaid_days INTEGER;
BEGIN
    /* Smart Guard: التحقق من الصلاحية عند التحديث */
    IF TG_OP = 'UPDATE' AND (
       (NEW.leave_status = 'approved' AND OLD.leave_status IS DISTINCT FROM 'approved') 
       OR (NEW.cancellation_status = 'approved' AND OLD.cancellation_status IS DISTINCT FROM 'approved')
    ) THEN
        IF (auth.uid() != NEW.supervisor_id) AND (NOT public.is_privileged_user()) AND (COALESCE(NEW.is_mandatory, false) = false) THEN
            RAISE EXCEPTION 'Unauthorized';
        END IF;
    END IF;

    /* Skip if no change in main statuses during UPDATE */
    IF TG_OP = 'UPDATE' 
       AND NEW.status = OLD.status 
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
        RAISE EXCEPTION 'لم يتم العثور على سجل مالي للموظف صاحب الطلب.';
    END IF;

    IF NEW.leave_type = 'unpaid' THEN
        v_paid_days := 0;
        v_unpaid_days := NEW.days_count;
    ELSE
        v_unpaid_days := COALESCE(NEW.unpaid_days, 0);
        v_paid_days := NEW.days_count - v_unpaid_days;
    END IF;

    -- =====================================================================
    -- القاعدة 1: الموافقة على الإجازة (خصم الرصيد) — تدعم INSERT و UPDATE
    -- =====================================================================
    IF (
        (TG_OP = 'INSERT' AND NEW.leave_status = 'approved') OR
        (TG_OP = 'UPDATE' AND NEW.leave_status = 'approved' AND OLD.leave_status IS DISTINCT FROM 'approved')
       ) AND NEW.is_deducted = FALSE THEN
        
        -- خصم الأيام المدفوعة
        IF NEW.leave_type IN ('sick', 'long_sick') THEN
            UPDATE public.financial_records SET sick_leaves_balance = sick_leaves_balance - v_paid_days WHERE user_id = NEW.user_id;
        ELSIF NEW.leave_type IN ('regular', 'long_regular') THEN
            UPDATE public.financial_records SET remaining_leaves_balance = remaining_leaves_balance - v_paid_days WHERE user_id = NEW.user_id;
        END IF;

        -- تراكم غير المدفوع إن وجد
        IF v_unpaid_days > 0 THEN
            UPDATE public.financial_records SET unpaid_leaves_total = COALESCE(unpaid_leaves_total, 0) + v_unpaid_days WHERE user_id = NEW.user_id;
        END IF;

        NEW.is_deducted := TRUE;
        v_leave_year := CAST(EXTRACT(YEAR FROM NEW.start_date) AS INTEGER);
        
        INSERT INTO public.leaves_details (user_id, year, leave_type, start_date, end_date, duration, created_at)
        VALUES (NEW.user_id, v_leave_year, 'normal', NEW.start_date, NEW.end_date, NEW.days_count, NOW());

        v_action_type := 'leave_approved';
        v_new_balance := v_previous_balance - v_paid_days;

    -- =====================================================================
    -- القاعدة 2: الموافقة على الإلغاء (استرجاع الرصيد) — في UPDATE فقط
    -- =====================================================================
    ELSIF TG_OP = 'UPDATE' AND (NEW.cancellation_status = 'approved' AND OLD.cancellation_status IS DISTINCT FROM 'approved') AND NEW.is_deducted = TRUE THEN
        
        IF NEW.leave_type IN ('sick', 'long_sick') THEN
            UPDATE public.financial_records SET sick_leaves_balance = sick_leaves_balance + v_paid_days WHERE user_id = NEW.user_id;
        ELSIF NEW.leave_type IN ('regular', 'long_regular') THEN
            UPDATE public.financial_records SET remaining_leaves_balance = remaining_leaves_balance + v_paid_days WHERE user_id = NEW.user_id;
        END IF;

        IF v_unpaid_days > 0 THEN
            UPDATE public.financial_records SET unpaid_leaves_total = GREATEST(0, COALESCE(unpaid_leaves_total, 0) - v_unpaid_days) WHERE user_id = NEW.user_id;
        END IF;

        NEW.is_deducted := FALSE;
        DELETE FROM public.leaves_details WHERE user_id = NEW.user_id AND start_date = NEW.start_date AND duration = NEW.days_count;
        
        v_action_type := 'cancellation_approved';
        v_new_balance := v_previous_balance + v_paid_days;

    -- =====================================================================
    -- القاعدة 3: الرفض المتأخر بعد الخصم (تصحيح الرصيد) — في UPDATE فقط
    -- =====================================================================
    ELSIF TG_OP = 'UPDATE' AND (NEW.leave_status = 'rejected' AND OLD.leave_status IS DISTINCT FROM 'rejected') AND NEW.is_deducted = TRUE THEN
        
        IF NEW.leave_type IN ('sick', 'long_sick') THEN
            UPDATE public.financial_records SET sick_leaves_balance = sick_leaves_balance + v_paid_days WHERE user_id = NEW.user_id;
        ELSIF NEW.leave_type IN ('regular', 'long_regular') THEN
            UPDATE public.financial_records SET remaining_leaves_balance = remaining_leaves_balance + v_paid_days WHERE user_id = NEW.user_id;
        END IF;

        IF v_unpaid_days > 0 THEN
            UPDATE public.financial_records SET unpaid_leaves_total = GREATEST(0, COALESCE(unpaid_leaves_total, 0) - v_unpaid_days) WHERE user_id = NEW.user_id;
        END IF;

        NEW.is_deducted := FALSE;
        DELETE FROM public.leaves_details WHERE user_id = NEW.user_id AND start_date = NEW.start_date AND duration = NEW.days_count;
        
        v_action_type := 'leave_rejected_after_deduction';
        v_new_balance := v_previous_balance + v_paid_days;
    END IF;

    -- توثيق التاريخ (Audit Trail) - يعمل في حالة UPDATE فقط لأن صف leave_requests يكون موجوداً بالفعل
    IF v_action_type IS NOT NULL AND TG_OP = 'UPDATE' THEN
        INSERT INTO public.leave_history (leave_request_id, action_type, previous_balance, new_balance, actor_id, created_at)
        VALUES (NEW.id, v_action_type, v_previous_balance, v_new_balance, COALESCE(auth.uid(), NEW.user_id), NOW());
    END IF;

    RETURN NEW;
END;
$function$;

-- إعادة ربط التريغر ليعمل على BEFORE INSERT OR UPDATE
DROP TRIGGER IF EXISTS leave_state_machine_trigger ON public.leave_requests;
CREATE TRIGGER leave_state_machine_trigger
BEFORE INSERT OR UPDATE ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.handle_leave_state_machine();


-- ============================================================
-- توثيق الأرشيف للطلبات التي تُدرج بحالة approved مباشرة (AFTER INSERT)
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_leave_insert_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_curr_balance INTEGER;
    v_prev_balance INTEGER;
    v_paid_days INTEGER;
    v_unpaid_days INTEGER;
BEGIN
    IF NEW.leave_status = 'approved' AND NEW.is_deducted = TRUE AND NEW.leave_type NOT IN ('dispatch', 'duty', 'time_off') THEN
        IF NEW.leave_type IN ('sick', 'long_sick') THEN
            SELECT sick_leaves_balance INTO v_curr_balance FROM public.financial_records WHERE user_id = NEW.user_id;
        ELSE
            SELECT remaining_leaves_balance INTO v_curr_balance FROM public.financial_records WHERE user_id = NEW.user_id;
        END IF;

        IF NEW.leave_type = 'unpaid' THEN
            v_paid_days := 0;
        ELSE
            v_unpaid_days := COALESCE(NEW.unpaid_days, 0);
            v_paid_days := NEW.days_count - v_unpaid_days;
        END IF;

        v_prev_balance := COALESCE(v_curr_balance, 0) + v_paid_days;

        INSERT INTO public.leave_history (leave_request_id, action_type, previous_balance, new_balance, actor_id, created_at)
        VALUES (NEW.id, 'leave_approved', v_prev_balance, v_curr_balance, COALESCE(auth.uid(), NEW.user_id), NOW());
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS log_leave_insert_history_trigger ON public.leave_requests;
CREATE TRIGGER log_leave_insert_history_trigger
AFTER INSERT ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.log_leave_insert_history();

NOTIFY pgrst, 'reload schema';
