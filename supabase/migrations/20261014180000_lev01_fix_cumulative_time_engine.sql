-- ============================================================
-- BE-LEV-01: تصحيح وتفعيل محرك الزمنيات التراكمية (قانون 7 ساعات = يوم)
-- 1. تصحيح دالة convert_cumulative_time لتقرأ cumulative_minutes_remaining
-- 2. ربط اعتماد الزمنيات (time_off) بزيادة الرصيد التراكمي وتحويله فورياً
-- ============================================================

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
            user_id, leave_type, start_date, end_date, days_count, status, leave_status, reason, is_deducted, created_at
        ) VALUES (
            v_user.user_id, 'cumulative_time', CURRENT_DATE, CURRENT_DATE, v_days, 'approved', 'approved', 'تحويل تلقائي للزمنيات المتراكمة (كل 7 ساعات = يوم)', TRUE, NOW()
        ) RETURNING id INTO v_new_request_id;
        
        -- ب) إضافة سجل الأرشفة في leaves_details
        INSERT INTO public.leaves_details (
            user_id, year, leave_type, start_date, end_date, duration, created_at
        ) VALUES (
            v_user.user_id, EXTRACT(YEAR FROM CURRENT_DATE)::integer, 'cumulative_time', CURRENT_DATE, CURRENT_DATE, v_days, NOW()
        );
        
        -- ج) خصم الزمنيات وخصم الأيام من رصيد الإجازات الاعتيادية
        UPDATE public.financial_records
        SET 
            cumulative_minutes_remaining = v_minutes_remaining,
            remaining_leaves_balance = remaining_leaves_balance - v_days,
            last_modified_at = NOW()
        WHERE user_id = v_user.user_id;

        -- د) توثيق في سجل التاريخ leave_history
        INSERT INTO public.leave_history (
            leave_request_id, action_type, previous_balance, new_balance, actor_id, created_at
        ) VALUES (
            v_new_request_id, 'cumulative_time_converted', 
            (SELECT remaining_leaves_balance + v_days FROM public.financial_records WHERE user_id = v_user.user_id),
            (SELECT remaining_leaves_balance FROM public.financial_records WHERE user_id = v_user.user_id),
            v_user.user_id, NOW()
        );

        -- هـ) إرسال إشعار للموارد البشرية
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

        -- و) إشعار الموظف نفسه
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

-- دالة التريغر لتسجيل دقائق الزمنية عند الموافقة عليها
CREATE OR REPLACE FUNCTION public.trg_fn_accumulate_time_off()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_mins INTEGER;
BEGIN
    -- تنطبق فقط على الإجازات الزمنية المعتمدة التي لم يتم تجميعها بعد
    IF NEW.leave_type = 'time_off' 
       AND (NEW.status = 'approved' OR NEW.leave_status = 'approved')
       AND (OLD IS NULL OR (OLD.status IS DISTINCT FROM 'approved' AND OLD.leave_status IS DISTINCT FROM 'approved'))
    THEN
        v_mins := COALESCE(NEW.time_duration_minutes, 0);
        
        -- إذا كانت الدقائق غير محددة صراحة، استخرجها من البداية والنهاية
        IF v_mins <= 0 AND NEW.leave_start_time IS NOT NULL AND NEW.leave_end_time IS NOT NULL THEN
            v_mins := EXTRACT(HOUR FROM (NEW.leave_end_time::time - NEW.leave_start_time::time)) * 60 +
                      EXTRACT(MINUTE FROM (NEW.leave_end_time::time - NEW.leave_start_time::time));
        END IF;

        IF v_mins > 0 THEN
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

-- إنشاء التريغر على leave_requests ليعمل عند الإدراج أو التحديث
DROP TRIGGER IF EXISTS trg_accumulate_time_off ON public.leave_requests;
CREATE TRIGGER trg_accumulate_time_off
AFTER INSERT OR UPDATE OF status, leave_status ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_accumulate_time_off();

-- تحديث الـ schema cache لـ PostgREST
NOTIFY pgrst, 'reload schema';
