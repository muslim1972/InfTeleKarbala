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
    -- [الحارس الذكي]: حماية تغيير الحالات الحساسة
    -- لا يسمح بالموافقة إلا إذا كان المستخدم هو (المسؤول المباشر المحدد في الطلب) OR (أدمن مخول)
    IF (NEW.leave_status = 'approved' AND OLD.leave_status IS DISTINCT FROM 'approved') 
       OR (NEW.cancellation_status = 'approved' AND OLD.cancellation_status IS DISTINCT FROM 'approved')
    THEN
        IF (auth.uid() != NEW.supervisor_id) AND (NOT public.is_privileged_user()) THEN
            RAISE EXCEPTION 'غير مصرح: يجب أن تكون المسؤول المباشر المحدد في هذا الطلب أو تملك صلاحيات إدارية للموافقة.';
        END IF;
    END IF;

    -- تجاوز المعالجة إذا لم يكن هناك تغيير في الحالات الرئيسية التي تتطلب تعديل الرصيد
    IF NEW.status = OLD.status 
       AND NEW.leave_status = OLD.leave_status
       AND NEW.cancellation_status = OLD.cancellation_status 
       AND NEW.cut_status = OLD.cut_status
    THEN
        RETURN NEW;
    END IF;

    -- جلب الرصيد المالي الحالي
    SELECT remaining_leaves_balance INTO v_previous_balance
    FROM public.financial_records WHERE user_id = NEW.user_id;

    IF v_previous_balance IS NULL THEN
        RAISE EXCEPTION 'لم يتم العثور على سجل مالي للموظف صاحب الطلب.';
    END IF;

    v_paid_days := NEW.days_count - COALESCE(NEW.unpaid_days, 0);

    -- =====================================================================
    -- القاعدة 1: الموافقة على الإجازة (خصم الرصيد)
    -- =====================================================================
    IF (NEW.leave_status = 'approved' AND OLD.leave_status IS DISTINCT FROM 'approved') AND NEW.is_deducted = FALSE THEN
        UPDATE public.financial_records SET remaining_leaves_balance = remaining_leaves_balance - v_paid_days WHERE user_id = NEW.user_id;
        NEW.is_deducted := TRUE;
        v_leave_year := CAST(EXTRACT(YEAR FROM NEW.start_date) AS INTEGER);
        
        INSERT INTO public.leaves_details (user_id, year, leave_type, start_date, end_date, duration, created_at)
        VALUES (NEW.user_id, v_leave_year, 'normal', NEW.start_date, NEW.end_date, NEW.days_count, NOW());

        v_action_type := 'leave_approved';
        v_new_balance := v_previous_balance - v_paid_days;

    -- =====================================================================
    -- القاعدة 2: الموافقة على الإلغاء (استرجاع الرصيد)
    -- =====================================================================
    ELSIF (NEW.cancellation_status = 'approved' AND OLD.cancellation_status IS DISTINCT FROM 'approved') AND NEW.is_deducted = TRUE THEN
        UPDATE public.financial_records SET remaining_leaves_balance = remaining_leaves_balance + v_paid_days WHERE user_id = NEW.user_id;
        NEW.is_deducted := FALSE;
        DELETE FROM public.leaves_details WHERE user_id = NEW.user_id AND start_date = NEW.start_date AND duration = NEW.days_count;
        
        v_action_type := 'cancellation_approved';
        v_new_balance := v_previous_balance + v_paid_days;

    -- =====================================================================
    -- القاعدة 3: الرفض المتأخر بعد الخصم (تصحيح الرصيد)
    -- =====================================================================
    ELSIF (NEW.leave_status = 'rejected' AND OLD.leave_status IS DISTINCT FROM 'rejected') AND NEW.is_deducted = TRUE THEN
        UPDATE public.financial_records SET remaining_leaves_balance = remaining_leaves_balance + v_paid_days WHERE user_id = NEW.user_id;
        NEW.is_deducted := FALSE;
        DELETE FROM public.leaves_details WHERE user_id = NEW.user_id AND start_date = NEW.start_date AND duration = NEW.days_count;
        
        v_action_type := 'leave_rejected_after_deduction';
        v_new_balance := v_previous_balance + v_paid_days;

    -- =====================================================================
    -- القاعدة 4: التعديل وإرجاع الطلب إلى قيد الانتظار (استرجاع الرصيد القديم)
    -- =====================================================================
    ELSIF (NEW.leave_status = 'pending' AND OLD.leave_status = 'approved') AND NEW.is_deducted = TRUE THEN
        -- هنا نقوم بإرجاع الأيام القديمة (قبل التعديل) باستخدام OLD.days_count
        UPDATE public.financial_records SET remaining_leaves_balance = remaining_leaves_balance + (OLD.days_count - COALESCE(OLD.unpaid_days, 0)) WHERE user_id = NEW.user_id;
        NEW.is_deducted := FALSE;
        DELETE FROM public.leaves_details WHERE user_id = NEW.user_id AND start_date = OLD.start_date AND duration = OLD.days_count;
        
        v_action_type := 'leave_edited_refund';
        v_new_balance := v_previous_balance + (OLD.days_count - COALESCE(OLD.unpaid_days, 0));
    END IF;

    -- توثيق التاريخ (Audit Trail)
    IF v_action_type IS NOT NULL THEN
        INSERT INTO public.leave_history (leave_request_id, action_type, previous_balance, new_balance, actor_id, created_at)
        VALUES (NEW.id, v_action_type, v_previous_balance, v_new_balance, auth.uid(), NOW());
    END IF;

    RETURN NEW;
END;
$$;
