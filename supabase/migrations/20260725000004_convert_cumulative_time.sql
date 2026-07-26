-- Migration 4: convert_cumulative_time
-- No single line arabic comments inside functions

CREATE OR REPLACE FUNCTION public.convert_cumulative_time()
RETURNS void AS $$
DECLARE
    v_user RECORD;
    v_total_minutes INTEGER;
    v_days INTEGER;
    v_new_remainder INTEGER;
BEGIN
    FOR v_user IN 
        SELECT DISTINCT user_id 
        FROM public.leave_requests 
        WHERE leave_type = 'time_off' 
          AND status = 'approved' 
          AND converted_to_cumulative = FALSE
    LOOP
        /* Sum time off minutes */
        SELECT COALESCE(SUM(time_duration_minutes), 0) 
        INTO v_total_minutes
        FROM public.leave_requests
        WHERE user_id = v_user.user_id
          AND leave_type = 'time_off'
          AND status = 'approved'
          AND converted_to_cumulative = FALSE;
        
        /* Add previously carried over minutes */
        v_total_minutes := v_total_minutes + 
            COALESCE((SELECT cumulative_minutes_remaining 
                      FROM public.financial_records 
                      WHERE user_id = v_user.user_id), 0);
        
        /* 1 Day = 420 Minutes (7 Hours) */
        v_days := v_total_minutes / 420; 
        v_new_remainder := v_total_minutes % 420;
        
        IF v_days >= 1 THEN
            /* Insert cumulative leave */
            INSERT INTO public.leave_requests (
                user_id, leave_type, days_count, 
                start_date, end_date, status, leave_status,
                converted_to_cumulative, reason,
                created_at, is_deducted
            ) VALUES (
                v_user.user_id, 'cumulative_time', v_days,
                CURRENT_DATE, 
                CURRENT_DATE + v_days - 1,
                'approved', 'approved',
                FALSE, 
                'Converted ' || v_days || ' days from ' || v_total_minutes || ' minutes',
                NOW(),
                TRUE
            );
            
            /* Update financial records */
            UPDATE public.financial_records
            SET remaining_leaves_balance = remaining_leaves_balance - v_days,
                cumulative_minutes_remaining = v_new_remainder,
                last_modified_at = NOW()
            WHERE user_id = v_user.user_id;
            
            /* Mark existing time off requests as converted */
            UPDATE public.leave_requests
            SET converted_to_cumulative = TRUE
            WHERE user_id = v_user.user_id
              AND leave_type = 'time_off'
              AND status = 'approved'
              AND converted_to_cumulative = FALSE;
            
            /* Notify HR Admin */
            INSERT INTO public.notifications (user_id, type, title, body, data, created_at)
            SELECT id, 'info', 'Cumulative Leaves Conversion',
                'Converted ' || v_days || ' days for Employee ID: ' || v_user.user_id,
                jsonb_build_object('leave_type', 'cumulative_time', 'days', v_days),
                NOW()
            FROM public.profiles 
            WHERE role = 'admin' OR admin_role = 'hr_supervisor';
        ELSE
            /* Update remainder only */
            UPDATE public.financial_records
            SET cumulative_minutes_remaining = v_new_remainder,
                last_modified_at = NOW()
            WHERE user_id = v_user.user_id;
            
            /* Mark existing time off requests as converted (their minutes are now in remainder) */
            UPDATE public.leave_requests
            SET converted_to_cumulative = TRUE
            WHERE user_id = v_user.user_id
              AND leave_type = 'time_off'
              AND status = 'approved'
              AND converted_to_cumulative = FALSE;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

/* Enable pg_cron if not already enabled and schedule */
/*
SELECT cron.schedule(
  'convert-cumulative-time-daily', 
  '0 0 * * *',
  'SELECT public.convert_cumulative_time();'
);
*/
