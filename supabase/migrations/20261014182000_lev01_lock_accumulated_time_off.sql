-- ============================================================
-- BE-LEV-01: تأشير وإغلاق طلبات الإجازات الزمنية لمنع تكرار دخولها في الحساب
-- 1. منع دخول أي طلب تم تجميعه مسبقاً (is_deducted = true)
-- 2. وسم الطلبات المجمعة بـ converted_to_cumulative = true عند تحويلها
-- ============================================================

CREATE OR REPLACE FUNCTION public.trg_fn_accumulate_time_off()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_mins INTEGER;
BEGIN
    -- تنطبق فقط على الإجازات الزمنية المعتمدة التي لم يتم تجميعها مسبقاً
    IF NEW.leave_type = 'time_off' 
       AND (NEW.status = 'approved' OR NEW.leave_status = 'approved')
       AND COALESCE(NEW.is_deducted, false) = false
       AND COALESCE(NEW.converted_to_cumulative, false) = false
    THEN
        v_mins := COALESCE(NEW.time_duration_minutes, 0);
        
        IF v_mins <= 0 AND NEW.leave_start_time IS NOT NULL AND NEW.leave_end_time IS NOT NULL THEN
            v_mins := EXTRACT(HOUR FROM (NEW.leave_end_time::time - NEW.leave_start_time::time)) * 60 +
                      EXTRACT(MINUTE FROM (NEW.leave_end_time::time - NEW.leave_start_time::time));
        END IF;

        IF v_mins > 0 THEN
            -- تأشير الطلب فوراً كـ تم الخصم/التجميع
            NEW.is_deducted := true;

            -- زيادة دقائق الزمنيات التراكمية في financial_records
            UPDATE public.financial_records
            SET cumulative_minutes_remaining = COALESCE(cumulative_minutes_remaining, 0) + v_mins,
                last_modified_at = NOW()
            WHERE user_id = NEW.user_id;

            -- تحويل فوري إذا بلغت أو تجاوزت 420 دقيقة (7 ساعات)
            PERFORM public.convert_cumulative_time();
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- إعادة إنشاء التريغر كـ BEFORE INSERT OR UPDATE حتى يستطيع تعديل NEW.is_deducted
DROP TRIGGER IF EXISTS trg_accumulate_time_off ON public.leave_requests;
CREATE TRIGGER trg_accumulate_time_off
BEFORE INSERT OR UPDATE OF status, leave_status ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_accumulate_time_off();

-- تحديث دالة convert_cumulative_time لتوسيم الطلبات التي تم تحويلها
CREATE OR REPLACE FUNCTION public.convert_cumulative_time()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_user RECORD;
    v_days INTEGER;
    v_minutes_remaining INTEGER;
    v_new_request_id UUID;
    v_hr RECORD;
BEGIN
    FOR v_user IN
        SELECT user_id, cumulative_minutes_remaining
        FROM public.financial_records
        WHERE cumulative_minutes_remaining >= 420
    LOOP
        v_days := FLOOR(v_user.cumulative_minutes_remaining / 420);
        v_minutes_remaining := v_user.cumulative_minutes_remaining % 420;
        
        -- أ) إضافة الطلب معتمد مباشرة (cumulative_time)
        INSERT INTO public.leave_requests (
            user_id, leave_type, start_date, end_date, days_count, status, leave_status, reason, is_deducted, converted_to_cumulative, created_at
        ) VALUES (
            v_user.user_id, 'cumulative_time', CURRENT_DATE, CURRENT_DATE, v_days, 'approved', 'approved', 'تحويل تلقائي للزمنيات المتراكمة (كل 7 ساعات = يوم)', TRUE, TRUE, NOW()
        ) RETURNING id INTO v_new_request_id;
        
        -- ب) تأشير الطلبات الزمنية السابقة التي ساهمت في هذا التحويل بـ converted_to_cumulative = true
        UPDATE public.leave_requests
        SET converted_to_cumulative = true
        WHERE user_id = v_user.user_id
          AND leave_type = 'time_off'
          AND is_deducted = true
          AND converted_to_cumulative = false;

        -- ج) إضافة سجل الأرشفة في leaves_details
        INSERT INTO public.leaves_details (
            user_id, year, leave_type, start_date, end_date, duration, created_at
        ) VALUES (
            v_user.user_id, EXTRACT(YEAR FROM CURRENT_DATE)::integer, 'cumulative_time', CURRENT_DATE, CURRENT_DATE, v_days, NOW()
        );
        
        -- د) خصم الزمنيات وخصم الأيام من رصيد الإجازات الاعتيادية
        UPDATE public.financial_records
        SET 
            cumulative_minutes_remaining = v_minutes_remaining,
            remaining_leaves_balance = remaining_leaves_balance - v_days,
            last_modified_at = NOW()
        WHERE user_id = v_user.user_id;

        -- هـ) توثيق في سجل التاريخ leave_history
        INSERT INTO public.leave_history (
            leave_request_id, action_type, previous_balance, new_balance, actor_id, created_at
        ) VALUES (
            v_new_request_id, 'cumulative_time_converted', 
            (SELECT remaining_leaves_balance + v_days FROM public.financial_records WHERE user_id = v_user.user_id),
            (SELECT remaining_leaves_balance FROM public.financial_records WHERE user_id = v_user.user_id),
            v_user.user_id, NOW()
        );

        -- و) إرسال إشعار للموارد البشرية
        FOR v_hr IN (
            SELECT id FROM public.profiles WHERE role = 'admin' OR admin_role = 'hr_supervisor'
        ) LOOP
            INSERT INTO public.system_notifications (
                recipient_id, sender_id, type, title, content, metadata, created_at
            ) VALUES (
                v_hr.id, v_user.user_id, 'system_alert',
                'تحويل زمنيات تراكمية',
                'تم تحويل ' || v_days || ' يوم إجازة اعتيادية للموظف لاكتمال ' || (v_days * 7) || ' ساعات زمنية.',
                jsonb_build_object('request_id', v_new_request_id, 'leave_type', 'cumulative_time', 'days', v_days),
                NOW()
            );
        END LOOP;

        -- ز) إشعار الموظف نفسه
        INSERT INTO public.system_notifications (
            recipient_id, sender_id, type, title, content, metadata, created_at
        ) VALUES (
            v_user.user_id, v_user.user_id, 'system_alert',
            'تحويل زمنياتك التراكمية إلى إجازة',
            'تم اكتمال ' || (v_days * 7) || ' ساعات من رصيد زمنياتك، وحُوِّلت تلقائياً إلى ' || v_days || ' يوم إجازة اعتيادية وخُصمت من رصيدك.',
            jsonb_build_object('request_id', v_new_request_id, 'leave_type', 'cumulative_time', 'days', v_days),
            NOW()
        );

    END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
