-- ==============================================================================
-- Migration: 20261125010000_att09_sync_db_shift_evaluators.sql
-- Kernel: BE-ATT-02 / BE-ATT-04 / BE-ATT-05 / BE-ATT-06
-- Purpose: Sync Postgres shift evaluation, closeout, roster audit, and kiosk
--          employee queries with get_effective_work_hours() temporary overrides.
-- ==============================================================================

-- 1. تحديث محرك التقييم اليومي للدوام الصباحي
CREATE OR REPLACE FUNCTION public.evaluate_morning_shift_daily_attendance(
    p_date date DEFAULT (((now() AT TIME ZONE 'Asia/Baghdad'::text) - '02:00:00'::interval))::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_next_work_date date;
  v_date_str text;
  v_next_date_str text;
  v_deadline_phrase text;
  v_dow int;
  v_day_name_ar text;
  v_emp record;
  v_att record;
  v_eff record;
  v_m_start time;
  v_m_end time;
  v_on_time_limit time;
  v_early_leave_limit time;
  v_raw_list jsonb;
  v_punches_arr jsonb[] := '{}';
  v_p record;
  v_prev_t timestamptz;
  v_curr_t timestamptz;
  v_count int;
  v_first_punch jsonb;
  v_last_punch jsonb;
  v_first_time time;
  v_last_time time;
  v_delay_mins int;
  v_early_mins int;
  v_emp_tri_name text;
  v_sup_id uuid;
  v_notif_content text;
  v_eval_type text;
  v_time_leave record;
  v_tl_start time;
  v_tl_end time;
  v_unjustified_count int := 0;
  v_unjustified_first_time text := '';
  v_virtual_iso timestamptz;
  v_virtual_tag text;
  v_day_names text[] := ARRAY['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  v_total_evaluated int := 0;
  v_on_time_count int := 0;
  v_delayed_count int := 0;
  v_early_leave_count int := 0;
  v_absent_count int := 0;
  v_notifications_sent int := 0;
BEGIN
  IF (now() AT TIME ZONE 'Asia/Baghdad')::time BETWEEN '06:00:00'::time AND '20:00:00'::time 
     AND p_date = (now() AT TIME ZONE 'Asia/Baghdad')::date THEN
    RAISE EXCEPTION 'لا يمكن تشغيل فحص الإغلاق الصباحي التلقائي نهاراً أثناء ساعات الدوام الفعلي (الوقت الحالي في بغداد: %)', (now() AT TIME ZONE 'Asia/Baghdad')::time;
  END IF;

  v_next_work_date := public.get_next_official_work_day(p_date);
  v_date_str := to_char(p_date, 'YYYY/MM/DD');
  v_next_date_str := to_char(v_next_work_date, 'YYYY/MM/DD');
  v_dow := EXTRACT(DOW FROM v_next_work_date)::int;
  v_day_name_ar := v_day_names[v_dow + 1];

  IF v_next_work_date = p_date + 1 THEN
    v_deadline_phrase := 'من يوم غد ' || v_next_date_str;
  ELSE
    v_deadline_phrase := 'من يوم ' || v_day_name_ar || ' ' || v_next_date_str;
  END IF;

  FOR v_emp IN
    SELECT 
      p.id,
      p.full_name,
      p.department_id,
      p.governorate,
      p.work_schedule_id,
      ws.type AS schedule_type,
      ws.name AS schedule_name,
      wsd.is_morning,
      wsd.is_rest_day
    FROM public.profiles p
    LEFT JOIN public.work_schedules ws ON ws.id = p.work_schedule_id
    LEFT JOIN public.work_schedule_days wsd 
      ON wsd.schedule_id = ws.id 
      AND wsd.day_of_week = EXTRACT(DOW FROM p_date)::int
    WHERE 
      p.id IS NOT NULL
      AND (
        (
          (ws.id IS NULL OR ws.type <> 'roster' AND COALESCE(ws.name, '') NOT ILIKE '%مناوب%' AND COALESCE(ws.name, '') NOT ILIKE '%خفر%')
          AND EXTRACT(DOW FROM p_date)::int NOT IN (5, 6)
          AND NOT EXISTS (
            SELECT 1 FROM public.official_holidays h
            WHERE p_date >= h.start_date AND p_date <= h.end_date
          )
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.leave_requests lr
        WHERE lr.user_id = p.id
          AND lr.status = 'approved'
          AND p_date >= lr.start_date 
          AND (lr.end_date IS NULL OR p_date <= lr.end_date)
          AND lr.leave_type IN ('regular', 'long_regular', 'sick', 'duty', 'dispatch')
      )
  LOOP
    BEGIN
      v_total_evaluated := v_total_evaluated + 1;
      v_emp_tri_name := public.extract_tripartite_name(v_emp.full_name);
      v_sup_id := public.get_direct_supervisor_id(v_emp.id);

      -- استعلام ساعات الدوام الفعلية لهذا اليوم (الأمر المؤقت إن وجد، وإلا الافتراضي)
      SELECT * INTO v_eff FROM public.get_effective_work_hours(p_date, v_emp.governorate);
      v_m_start := COALESCE(v_eff.morning_start, '08:00:00'::time);
      v_m_end   := COALESCE(v_eff.morning_end, '15:00:00'::time);
      v_on_time_limit := v_m_start + interval '30 minutes';
      v_early_leave_limit := v_m_end - interval '30 minutes';

      SELECT * INTO v_att 
      FROM public.attendance_records
      WHERE employee_id = v_emp.id
        AND (
          (check_in AT TIME ZONE 'Asia/Baghdad')::date = p_date
          OR (created_at AT TIME ZONE 'Asia/Baghdad')::date = p_date
        )
      ORDER BY created_at DESC
      LIMIT 1;

      v_punches_arr := '{}';
      v_prev_t := NULL;

      IF v_att.id IS NOT NULL AND v_att.raw_punches IS NOT NULL AND jsonb_array_length(v_att.raw_punches) > 0 THEN
        FOR v_p IN 
          SELECT punch 
          FROM jsonb_array_elements(v_att.raw_punches) AS punch
          WHERE COALESCE((punch->>'is_virtual')::boolean, false) = false
            AND COALESCE(punch->>'notes', '') NOT LIKE '%افتراضي%'
            AND ((punch->>'time')::timestamptz AT TIME ZONE 'Asia/Baghdad')::date = p_date
          ORDER BY (punch->>'time')::timestamptz ASC
        LOOP
          v_curr_t := (v_p.punch->>'time')::timestamptz;
          IF v_prev_t IS NULL OR EXTRACT(EPOCH FROM (v_curr_t - v_prev_t)) > 180 THEN
            v_punches_arr := array_append(v_punches_arr, v_p.punch);
            v_prev_t := v_curr_t;
          END IF;
        END LOOP;
      END IF;

      v_count := array_length(v_punches_arr, 1);

      IF v_count IS NULL OR v_count = 0 THEN
        v_absent_count := v_absent_count + 1;
        v_eval_type := 'morning_total_absence';

        v_notif_content := 'إن لديك تغيب عن الدوام الرسمي بتاريخ ' || v_date_str || 
          ' بدون عذر رسمي ، لذا توجب عليك تقديم إستيضاح مكتوب إلى المسؤول المباشر خلال 24 ساعة تنتهي عند 10:30 ' || 
          v_deadline_phrase || ' لتجنب اتخاذ الإجراء الرسمي بحقك';

        IF NOT EXISTS (
          SELECT 1 FROM public.system_notifications
          WHERE recipient_id = v_emp.id
            AND (metadata->>'record_date') = p_date::text
            AND (metadata->>'eval_type') = v_eval_type
        ) THEN
          INSERT INTO public.system_notifications(recipient_id, type, title, content, is_read, metadata)
          VALUES (
            v_emp.id,
            'attendance_morning_absence',
            'إشعار تغيب عن الدوام الرسمي',
            v_notif_content,
            false,
            jsonb_build_object('type', 'morning_attendance_alert', 'eval_type', v_eval_type, 'record_date', p_date::text)
          );
          v_notifications_sent := v_notifications_sent + 1;
        END IF;

      ELSE
        v_first_punch := v_punches_arr[1];
        v_last_punch := v_punches_arr[v_count];
        v_first_time := ((v_first_punch->>'time')::timestamptz AT TIME ZONE 'Asia/Baghdad')::time;
        v_last_time := ((v_last_punch->>'time')::timestamptz AT TIME ZONE 'Asia/Baghdad')::time;

        -- أ. تقييم وقت الحضور الصباحي المزحف (+30 دقيقة سماح)
        IF v_first_time <= v_on_time_limit THEN
          v_on_time_count := v_on_time_count + 1;
        ELSE
          v_delayed_count := v_delayed_count + 1;
          v_eval_type := 'morning_delay';
          v_delay_mins := floor(EXTRACT(EPOCH FROM (v_first_time - v_on_time_limit)) / 60)::int;
          IF v_delay_mins < 1 THEN v_delay_mins := 1; END IF;

          v_notif_content := 'لديك تأخير بمقدار (' || v_delay_mins || ' دقيقة) في بداية الدوام ليوم ' || 
            v_date_str || '، وسيصلك استيضاح ورقي من قبل الإدارة، يرجى التوجه لإداري القسم للإجابة عليه بأسرع وقت.';

          IF NOT EXISTS (
            SELECT 1 FROM public.system_notifications
            WHERE recipient_id = v_emp.id
              AND (metadata->>'record_date') = p_date::text
              AND (metadata->>'eval_type') = v_eval_type
          ) THEN
            INSERT INTO public.system_notifications(recipient_id, type, title, content, is_read, metadata)
            VALUES (
              v_emp.id,
              'attendance_morning_delay',
              'تبليغ استيضاح: تأخير في بداية الدوام',
              v_notif_content,
              false,
              jsonb_build_object('type', 'morning_attendance_alert', 'eval_type', v_eval_type, 'record_date', p_date::text, 'delay_minutes', v_delay_mins)
            );
            v_notifications_sent := v_notifications_sent + 1;
          END IF;
        END IF;

        -- ب. تقييم وقت الانصراف النهائي المزحف
        IF v_count = 1 THEN
          v_virtual_iso := ((p_date::timestamp + v_m_end) AT TIME ZONE 'Asia/Baghdad');
          v_virtual_tag := '(خروج نهائي افتراضي ' || to_char(v_m_end, 'HH24:MI') || ')';
          UPDATE public.attendance_records
          SET check_out = v_virtual_iso,
              check_out_is_virtual = true,
              check_out_virtual_reason = 'خروج افتراضي بنهاية الدوام الصباحي',
              notes = CASE 
                WHEN notes IS NULL OR notes = '' THEN v_virtual_tag
                WHEN notes LIKE '%خروج نهائي افتراضي%' THEN notes
                ELSE notes || ' | ' || v_virtual_tag
              END
          WHERE id = v_att.id;
        ELSIF v_count >= 2 THEN
          IF v_last_time < v_early_leave_limit THEN
            v_early_leave_count := v_early_leave_count + 1;
            v_eval_type := 'morning_early_leave';
            v_early_mins := floor(EXTRACT(EPOCH FROM (v_early_leave_limit - v_last_time)) / 60)::int;
            IF v_early_mins < 1 THEN v_early_mins := 1; END IF;

            v_notif_content := 'لديك مغادرة مبكرة بمقدار (' || v_early_mins || ' دقيقة) في نهاية الدوام ليوم ' || 
              v_date_str || '، وسيصلك استيضاح ورقي من قبل الإدارة، يرجى التوجه لإداري القسم للإجابة عليه بأسرع وقت.';

            IF NOT EXISTS (
              SELECT 1 FROM public.system_notifications
              WHERE recipient_id = v_emp.id
                AND (metadata->>'record_date') = p_date::text
                AND (metadata->>'eval_type') = v_eval_type
            ) THEN
              INSERT INTO public.system_notifications(recipient_id, type, title, content, is_read, metadata)
              VALUES (
                v_emp.id,
                'attendance_morning_early_leave',
                'تبليغ استيضاح: مغادرة مبكرة قبل نهاية الدوام',
                v_notif_content,
                false,
                jsonb_build_object('type', 'morning_attendance_alert', 'eval_type', v_eval_type, 'record_date', p_date::text, 'early_minutes', v_early_mins)
              );
              v_notifications_sent := v_notifications_sent + 1;
            END IF;
          END IF;
        END IF;

        -- ج. تقييم البصمات الوسطى
        IF v_count >= 3 THEN
          SELECT * INTO v_time_leave
          FROM public.leave_requests
          WHERE user_id = v_emp.id
            AND status = 'approved'
            AND start_date = p_date
            AND (leave_type = 'time_off' OR leave_type = 'time_leave' OR time_duration_minutes > 0)
            AND leave_start_time IS NOT NULL 
            AND leave_end_time IS NOT NULL
          LIMIT 1;

          IF v_time_leave.id IS NOT NULL THEN
            v_tl_end := v_time_leave.leave_end_time::time;
            IF v_count >= 3 THEN
              DECLARE
                v_mid_ret time := ((v_punches_arr[3]->>'time')::timestamptz AT TIME ZONE 'Asia/Baghdad')::time;
                v_ret_late_mins int;
              BEGIN
                IF v_mid_ret > v_tl_end AND v_mid_ret < v_early_leave_limit THEN
                  v_ret_late_mins := floor(EXTRACT(EPOCH FROM (v_mid_ret - v_tl_end)) / 60)::int;
                  IF v_ret_late_mins > 0 THEN
                    v_eval_type := 'time_leave_late_return';
                    v_notif_content := 'لديك عودة متأخرة بعد الزمنية بمقدار (' || v_ret_late_mins || ' دقيقة) ليوم ' || 
                      v_date_str || '، وسيصلك استيضاح ورقي من قبل الإدارة، يرجى التوجه لإداري القسم للإجابة عليه بأسرع وقت.';

                    IF NOT EXISTS (
                      SELECT 1 FROM public.system_notifications
                      WHERE recipient_id = v_emp.id
                        AND (metadata->>'record_date') = p_date::text
                        AND (metadata->>'eval_type') = v_eval_type
                    ) THEN
                      INSERT INTO public.system_notifications(recipient_id, type, title, content, is_read, metadata)
                      VALUES (
                        v_emp.id,
                        'attendance_time_leave_late_return',
                        'تبليغ استيضاح: تأخر في العودة من الإجازة الزمنية',
                        v_notif_content,
                        false,
                        jsonb_build_object('type', 'morning_attendance_alert', 'eval_type', v_eval_type, 'record_date', p_date::text, 'late_minutes', v_ret_late_mins)
                      );
                      v_notifications_sent := v_notifications_sent + 1;
                    END IF;
                  END IF;
                END IF;
              END;
            END IF;

          ELSE
            v_unjustified_count := 1;
            v_unjustified_first_time := to_char(((v_punches_arr[2]->>'time')::timestamptz AT TIME ZONE 'Asia/Baghdad'), 'HH24:MI');
            IF v_count >= 5 THEN
              v_unjustified_count := 2;
            END IF;

            IF v_unjustified_count = 1 THEN
              v_eval_type := 'unjustified_exit_single';
              v_notif_content := 'لديك مغادرة غير مبررة عند الساعة (' || v_unjustified_first_time || ') ليوم ' || 
                v_date_str || '، وسيصلك استيضاح ورقي من قبل الإدارة، يرجى التوجه لإداري القسم للإجابة عليه بأسرع وقت.';
            ELSE
              v_eval_type := 'unjustified_exit_double';
              v_notif_content := 'لديك مغادرتان غير مبررتان ليوم ' || 
                v_date_str || '، وسيصلك استيضاح ورقي من قبل الإدارة، يرجى التوجه لإداري القسم للإجابة عليه بأسرع وقت.';
            END IF;

            IF NOT EXISTS (
              SELECT 1 FROM public.system_notifications
              WHERE recipient_id = v_emp.id
                AND (metadata->>'record_date') = p_date::text
                AND (metadata->>'eval_type') = v_eval_type
            ) THEN
              INSERT INTO public.system_notifications(recipient_id, type, title, content, is_read, metadata)
              VALUES (
                v_emp.id,
                'attendance_unjustified_exit',
                'تبليغ استيضاح: مغادرة أثناء الدوام بدون مبرر',
                v_notif_content,
                false,
                jsonb_build_object('type', 'morning_attendance_alert', 'eval_type', v_eval_type, 'record_date', p_date::text, 'count', v_unjustified_count)
              );
              v_notifications_sent := v_notifications_sent + 1;
            END IF;
          END IF;
        END IF;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'فشل تقييم موظف % ليوم %: %', v_emp.id, p_date, SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'date', p_date,
    'next_work_date', v_next_work_date,
    'deadline_phrase', v_deadline_phrase,
    'total_evaluated', v_total_evaluated,
    'on_time', v_on_time_count,
    'delayed', v_delayed_count,
    'early_leave', v_early_leave_count,
    'absent', v_absent_count,
    'notifications_sent', v_notifications_sent
  );
END;
$function$;

-- 2. تحديث دالة الإغلاق اليومي closeout_prev_day_attendance لتقرأ التزحيف
CREATE OR REPLACE FUNCTION public.closeout_prev_day_attendance(p_employee_id uuid, p_followup boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_is_privileged boolean;
  v_today date := (now() AT TIME ZONE 'Asia/Baghdad')::date;
  v_prev_date date := v_today - 1;
  v_rec public.attendance_records%ROWTYPE;
  v_real_punches jsonb;
  v_real_count int;
  v_last_punch timestamptz;
  v_day_dow int;
  v_sched record;
  v_eff record;
  v_is_night boolean;
  v_night_end_local time;
  v_shift_end_local time;
  v_shift_end timestamptz;
  v_virtual_el jsonb;
  v_reason text;
  v_note text;
  v_emp record;
  v_result jsonb;
  v_ot_mins numeric;
  v_ot_hours numeric;
  v_ot_note text;
  v_now_baghdad timestamp := (now() AT TIME ZONE 'Asia/Baghdad');
  v_morning_handover_start timestamp;
BEGIN
  IF v_caller IS NULL THEN
    IF current_user NOT IN ('postgres', 'supabase_admin') THEN
      RAISE EXCEPTION 'غير مصرح: جلسة غير معتمدة';
    END IF;
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_caller
      AND (role IN ('admin', 'hr_manager', 'kiosk')
           OR admin_role IN ('general', 'developer'))
  ) INTO v_is_privileged;
  IF NOT v_is_privileged AND v_caller <> p_employee_id THEN
    RAISE EXCEPTION 'غير مصرح: إغلاق سجل يوم سابق مسموح لصاحب السجل أو للمميزين فقط';
  END IF;

  SELECT * INTO v_rec
  FROM public.attendance_records
  WHERE employee_id = p_employee_id
    AND (created_at AT TIME ZONE 'Asia/Baghdad')::date = v_prev_date
  ORDER BY created_at DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('action', 'noop', 'date', v_prev_date);
  END IF;

  IF v_rec.check_out IS NOT NULL THEN
    RETURN jsonb_build_object('action', 'already_closed', 'date', v_prev_date);
  END IF;

  SELECT COALESCE(jsonb_agg(p ORDER BY (p->>'time')), '[]'::jsonb)
    INTO v_real_punches
  FROM jsonb_array_elements(COALESCE(v_rec.raw_punches, '[]'::jsonb)) p
  WHERE COALESCE((p->>'is_virtual')::boolean, false) = false
    AND COALESCE(p->>'notes', '') NOT LIKE '%افتراضي%';
  v_real_count := jsonb_array_length(v_real_punches);
  IF v_real_count > 0 THEN
    v_last_punch := ((v_real_punches->(v_real_count - 1))->>'time')::timestamptz;
  END IF;

  SELECT full_name, governorate, department_id INTO v_emp
  FROM public.profiles WHERE id = p_employee_id;

  SELECT * INTO v_eff FROM public.get_effective_work_hours(v_prev_date, COALESCE(v_emp.governorate, 'karbala'));

  v_day_dow := EXTRACT(DOW FROM v_prev_date)::int;
  SELECT ws.id, ws.type,
         d.is_night, d.is_evening, d.is_morning, d.is_rest_day,
         d.start_time, d.end_time
    INTO v_sched
  FROM public.work_schedules ws
  LEFT JOIN public.work_schedule_days d
    ON d.schedule_id = ws.id AND d.day_of_week = v_day_dow
  WHERE ws.id = COALESCE(
    v_rec.work_schedule_id,
    (SELECT id FROM public.work_schedules WHERE is_default = true LIMIT 1)
  );
  v_is_night := COALESCE(v_sched.is_night, false);

  IF v_is_night THEN
    v_night_end_local := COALESCE(v_eff.night_end, time '08:00');
    v_shift_end := ((v_prev_date + 1)::timestamp + v_night_end_local) AT TIME ZONE 'Asia/Baghdad';
    v_morning_handover_start := ((v_prev_date + 1)::timestamp + (v_night_end_local - interval '90 minutes'));
  ELSE
    IF v_eff.id IS NOT NULL AND COALESCE(v_sched.type, '') <> 'special' THEN
      IF COALESCE(v_sched.is_evening, false) AND NOT COALESCE(v_sched.is_morning, false) THEN
        v_shift_end_local := v_eff.evening_end;
      ELSE
        v_shift_end_local := v_eff.morning_end;
      END IF;
    ELSE
      v_shift_end_local := COALESCE(v_sched.end_time, time '15:00');
    END IF;
    v_shift_end := (v_prev_date::timestamp + v_shift_end_local) AT TIME ZONE 'Asia/Baghdad';
    v_morning_handover_start := v_prev_date::timestamp + (v_shift_end_local - interval '30 minutes');
  END IF;

  IF v_is_night AND v_now_baghdad < v_morning_handover_start THEN
    RETURN jsonb_build_object('action', 'night_shift_ongoing', 'date', v_prev_date);
  END IF;

  IF (COALESCE(v_rec.check_out_is_virtual, false) = true OR v_rec.notes LIKE '%افتراضي%') AND v_real_count >= 2 THEN
    IF v_last_punch > v_shift_end THEN
      v_ot_mins := ROUND((EXTRACT(EPOCH FROM (v_last_punch - v_shift_end)) / 60)::numeric);
      v_ot_hours := ROUND((v_ot_mins / 60.0)::numeric, 1);
      v_ot_note := '(هناك ساعات إضافية = ' || v_ot_hours::text || ' ساعة)';
    ELSE
      v_ot_note := '';
    END IF;

    UPDATE public.attendance_records
       SET check_out = v_last_punch,
           check_out_is_virtual = false,
           check_out_virtual_reason = null,
           raw_punches = v_real_punches,
           notes = regexp_replace(
             regexp_replace(COALESCE(v_rec.notes, ''), '\|?\s*\(?بصمة خروج افتراضية حمراء[^\)]*\)?', '', 'g'),
             '\|?\s*\(?خروج نهائي افتراضي[^\)]*\)?', '', 'g'
           ) || CASE WHEN v_ot_note <> '' THEN ' | ' || v_ot_note ELSE '' END,
           updated_at = now()
     WHERE id = v_rec.id
    RETURNING to_jsonb(attendance_records.*) INTO v_result;

    IF v_ot_note <> '' THEN
      INSERT INTO public.system_notifications (recipient_id, type, title, content, is_read, metadata)
      SELECT pr.id, 'biometric_alert',
             '⏱️ بصمة انصراف حقيقية متأخرة وساعات إضافية',
             'الموظف (' || COALESCE(v_emp.full_name, '') || ') لديه بصمة انصراف حقيقية بعد نهاية الدوام ليوم ' || v_prev_date::text ||
             ' تم استبدال البصمة الافتراضية بها (' || v_ot_note || '). للعلم والمراجعة.',
             false,
             jsonb_build_object('type', 'overtime_alert', 'employee_id', p_employee_id, 'record_date', v_prev_date)
      FROM public.profiles pr
      WHERE pr.admin_role IN ('biometric', 'attendance_supervisor', 'general')
        AND pr.governorate = COALESCE(v_emp.governorate, 'karbala')
        AND pr.id <> p_employee_id;
    END IF;

    RETURN jsonb_build_object('action', 'replaced_virtual_with_real', 'date', v_prev_date, 'record', v_result);
  END IF;

  IF p_followup AND v_is_night AND v_now_baghdad >= v_morning_handover_start THEN
    UPDATE public.attendance_records
       SET check_out = now(),
           notes = COALESCE(v_rec.notes || ' | ', '') || '(انصراف خفارة الأمس: تسليم الشفت صباحاً)',
           updated_at = now()
     WHERE id = v_rec.id
    RETURNING to_jsonb(attendance_records.*) INTO v_result;
    RETURN jsonb_build_object('action', 'followup_out', 'date', v_prev_date, 'record', v_result);
  END IF;

  IF p_followup AND v_is_night THEN
    RETURN jsonb_build_object('action', 'night_shift_ongoing', 'date', v_prev_date);
  END IF;

  IF v_real_count % 2 = 1 OR (v_real_count = 0 AND v_rec.check_in IS NOT NULL) THEN
    v_reason := 'لم يثبت الموظف بصمة الخروج — وُضعت بصمة افتراضية (حمراء) بنهاية الدوام آلياً';
    v_note := '(بصمة خروج افتراضية حمراء: عدد البصمات فردي ولم يثبت خروج نهائي)';
    v_virtual_el := jsonb_build_object(
      'time', v_shift_end,
      'is_virtual', true,
      'notes', 'بصمة افتراضية حمراء: لم يثبت بصمة الخروج'
    );

    UPDATE public.attendance_records
       SET check_out = v_shift_end,
           check_out_is_virtual = true,
           check_out_virtual_reason = v_reason,
           raw_punches = COALESCE(v_rec.raw_punches, '[]'::jsonb) || v_virtual_el,
           notes = COALESCE(v_rec.notes || ' | ', '') || v_note,
           updated_at = now()
     WHERE id = v_rec.id
    RETURNING to_jsonb(attendance_records.*) INTO v_result;

    INSERT INTO public.system_notifications (recipient_id, type, title, content, is_read, metadata)
    SELECT pr.id, 'biometric_alert',
           '🔴 بصمة خروج افتراضية (حمراء)',
           'الموظف (' || COALESCE(v_emp.full_name, '') || ') لم يثبت بصمة خروج ليوم ' || v_prev_date::text ||
           ' (عدد البصمات فردي). وُضعت بصمة افتراضية بنهاية الدوام آلياً — للعلم والمراجعة.',
           false,
           jsonb_build_object('type', 'virtual_red_checkout', 'employee_id', p_employee_id, 'record_date', v_prev_date)
    FROM public.profiles pr
    WHERE pr.admin_role IN ('biometric', 'attendance_supervisor', 'general')
      AND pr.governorate = COALESCE(v_emp.governorate, 'karbala')
      AND pr.id <> p_employee_id;

    RETURN jsonb_build_object('action', 'virtual_out', 'date', v_prev_date, 'record', v_result);
  ELSE
    UPDATE public.attendance_records
       SET check_out = v_last_punch,
           notes = COALESCE(v_rec.notes || ' | ', '') || '(مغادرة مبكرة: اعتُمدت آخر بصمة كبصمة مغادرة لعدم إثبات خروج نهائي)',
           updated_at = now()
     WHERE id = v_rec.id
    RETURNING to_jsonb(attendance_records.*) INTO v_result;
    RETURN jsonb_build_object('action', 'derived_out', 'date', v_prev_date, 'record', v_result);
  END IF;
END;
$function$;

-- 3. تحديث محرك تقييم المناوبين roster_evaluate_day ليزحف الأوقات
CREATE OR REPLACE FUNCTION public.roster_evaluate_day(p_emp uuid, p_date date)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
  v_sched uuid; v_type text; v_from date; v_until date;
  d_today record; d_prev record;
  base timestamptz := (p_date::timestamp AT TIME ZONE 'Asia/Baghdad');
  units int := 0; parts text[] := '{}';
  kh1 boolean; prev_kh1 boolean;
  v_overlap int; v_name text;
  v_dept uuid; v_gov text; v_mgr uuid; r record;
  v_m_tl int := 0; v_e_tl int := 0; v_n_tl int := 0;
  v_eff record; v_eff_prev record;
  v_m_iv interval; v_e_iv interval; v_n_iv interval; v_prev_n_iv interval;
  v_n_end_time text;
  v_midnight_punches int := 0;
  v_midnight_verified boolean := false;
  v_rec_id uuid;
  v_existing_raw jsonb;
  v_alert_msg text;
BEGIN
  SELECT p.work_schedule_id, p.full_name, p.department_id, p.governorate
    INTO v_sched, v_name, v_dept, v_gov FROM profiles p WHERE p.id = p_emp;
  IF v_sched IS NULL THEN RETURN jsonb_build_object('skipped','no_schedule'); END IF;
  SELECT type, valid_from, valid_until INTO v_type, v_from, v_until FROM work_schedules WHERE id = v_sched;
  IF v_type <> 'roster' OR (v_from IS NOT NULL AND p_date < v_from) OR (v_until IS NOT NULL AND p_date > v_until)
    THEN RETURN jsonb_build_object('skipped','not_roster'); END IF;

  SELECT * INTO d_today FROM work_schedule_days WHERE schedule_id = v_sched AND day_of_week = extract(dow FROM p_date)::int;
  SELECT * INTO d_prev  FROM work_schedule_days WHERE schedule_id = v_sched AND day_of_week = extract(dow FROM p_date - 1)::int;

  SELECT * INTO v_eff FROM public.get_effective_work_hours(p_date, COALESCE(v_gov, 'karbala'));
  SELECT * INTO v_eff_prev FROM public.get_effective_work_hours(p_date - 1, COALESCE(v_gov, 'karbala'));

  v_m_iv := COALESCE(v_eff.morning_start, time '08:00')::interval;
  v_e_iv := COALESCE(v_eff.evening_start, time '15:00')::interval;
  v_n_iv := COALESCE(v_eff.night_start, time '20:00')::interval;
  v_prev_n_iv := COALESCE(v_eff_prev.night_start, time '20:00')::interval;
  v_n_end_time := to_char(COALESCE(v_eff_prev.night_end, time '08:00'), 'HH24:MI');

  SELECT coalesce(max(time_duration_minutes), 0) INTO v_m_tl FROM leave_requests
   WHERE user_id = p_emp AND status = 'approved' AND start_date = p_date
     AND leave_type = 'time_off' AND time_off_subtype = 'shift_start'
     AND (leave_start_time >= '06:00:00' AND leave_start_time < '14:00:00')
     AND coalesce(time_duration_minutes, 0) > 0;

  SELECT coalesce(max(time_duration_minutes), 0) INTO v_e_tl FROM leave_requests
   WHERE user_id = p_emp AND status = 'approved' AND start_date = p_date
     AND leave_type = 'time_off' AND time_off_subtype = 'shift_start'
     AND (leave_start_time >= '13:00:00' AND leave_start_time < '19:30:00')
     AND coalesce(time_duration_minutes, 0) > 0;

  SELECT coalesce(max(time_duration_minutes), 0) INTO v_n_tl FROM leave_requests
   WHERE user_id = p_emp AND status = 'approved' AND start_date = p_date
     AND leave_type = 'time_off' AND time_off_subtype = 'shift_start'
     AND (leave_start_time >= '18:30:00' OR leave_start_time < '06:00:00')
     AND coalesce(time_duration_minutes, 0) > 0;

  -- صباحي مزحف
  IF coalesce(d_today.is_morning,false) THEN
    IF v_m_tl > 0 THEN
      IF now() >= base + v_m_iv + (v_m_tl || ' minutes')::interval + interval '60 minutes'
         AND NOT roster_unit_attended(p_emp, base + v_m_iv + (v_m_tl || ' minutes')::interval, interval '5 minutes') THEN
        units := units + 1; parts := array_append(parts, 'صباحي'::text);
      END IF;
    ELSIF now() >= base + v_m_iv + interval '60 minutes' AND NOT roster_unit_attended(p_emp, base + v_m_iv) THEN
      units := units + 1; parts := array_append(parts, 'صباحي'::text);
    END IF;
  END IF;

  -- مسائي مزحف
  IF coalesce(d_today.is_evening,false) THEN
    IF v_e_tl > 0 THEN
      IF now() >= base + v_e_iv + (v_e_tl || ' minutes')::interval + interval '60 minutes'
         AND NOT roster_unit_attended(p_emp, base + v_e_iv + (v_e_tl || ' minutes')::interval, interval '5 minutes') THEN
        units := units + 1; parts := array_append(parts, 'مسائي'::text);
      END IF;
    ELSIF now() >= base + v_e_iv + interval '60 minutes' AND NOT roster_unit_attended(p_emp, base + v_e_iv) THEN
      units := units + 1; parts := array_append(parts, 'مسائي'::text);
    END IF;
  END IF;

  -- خفر النصف الأول مزحف
  IF coalesce(d_today.is_night,false) THEN
    IF v_n_tl > 0 THEN
      IF now() >= base + v_n_iv + (v_n_tl || ' minutes')::interval + interval '60 minutes' THEN
        kh1 := roster_unit_attended(p_emp, base + v_n_iv + (v_n_tl || ' minutes')::interval, interval '5 minutes');
        IF NOT kh1 THEN units := units + 1; parts := array_append(parts, ('خفر (' || to_char(COALESCE(v_eff.night_start, time '20:00'), 'HH24:MI') || '-24:00)')::text); END IF;
      END IF;
    ELSIF now() >= base + v_n_iv + interval '60 minutes' THEN
      kh1 := roster_unit_attended(p_emp, base + v_n_iv);
      IF NOT kh1 THEN units := units + 1; parts := array_append(parts, ('خفر (' || to_char(COALESCE(v_eff.night_start, time '20:00'), 'HH24:MI') || '-24:00)')::text); END IF;
    END IF;

    SELECT count(*) INTO v_midnight_punches
    FROM roster_real_punches(p_emp, base + interval '23 hours 15 minutes', base + interval '24 hours 45 minutes');

    IF v_midnight_punches > 0 THEN
      v_midnight_verified := true;
    ELSIF now() >= base + interval '24 hours' THEN
      SELECT id, raw_punches INTO v_rec_id, v_existing_raw
      FROM attendance_records
      WHERE employee_id = p_emp AND (created_at AT TIME ZONE 'Asia/Baghdad')::date = p_date
      ORDER BY created_at DESC LIMIT 1;

      IF v_rec_id IS NOT NULL THEN
        IF NOT (v_existing_raw::text LIKE '%لم يثبت حضور منتصف الليل%') THEN
          UPDATE attendance_records
          SET raw_punches = coalesce(raw_punches, '[]'::jsonb) || jsonb_build_object(
                'time', (base + interval '23 hours 59 minutes 59 seconds')::timestamptz,
                'notes', '(بصمة منتصف ليل افتراضية حمراء - لم يثبت حضور منتصف الليل)',
                'is_virtual', true
              ),
              admin_notes = coalesce(admin_notes || ' | ', '') || 'تنبيه تدقيق: لم يثبت الموظف حضوره عند منتصف الليل لشفت الخفر. يرجى مراجعة الكاميرات للتحقق من التواجد بالمقر.'
          WHERE id = v_rec_id;

          v_alert_msg := format('⚠️ تنبيه تدقيق: لم يثبت الموظف (%s) حضوره عند منتصف الليل لشفت الخفر لتاريخ %s. يرجى مراجعة الكاميرات.', v_name, p_date);
          FOR r IN
            SELECT id FROM profiles WHERE admin_role IN ('biometric','attendance_supervisor','general') AND governorate IS NOT DISTINCT FROM v_gov
          LOOP
            INSERT INTO system_notifications(recipient_id, title, content, type, metadata)
            VALUES (r.id, '⚠️ تدقيق حضور منتصف الليل', v_alert_msg, 'system',
                    jsonb_build_object('employee_id', p_emp, 'date', p_date, 'type', 'midnight_audit_alert'));
          END LOOP;
        END IF;
      END IF;
    END IF;
  END IF;

  -- خفر النصف الثاني (يتبع خفر الأمس المزحف)
  IF coalesce(d_prev.is_night,false) AND now() >= base + interval '1 hour' THEN
    prev_kh1 := roster_unit_attended(p_emp, (base - interval '24 hours') + v_prev_n_iv);
    IF NOT prev_kh1 AND NOT roster_unit_attended(p_emp, base, interval '30 minutes') THEN
      units := units + 1; parts := array_append(parts, ('خفر (00:00-' || v_n_end_time || ')')::text); END IF;
  END IF;

  SELECT count(*) INTO v_overlap FROM leave_requests
   WHERE user_id = p_emp AND status = 'approved' AND coalesce(is_mandatory,false) = false
     AND leave_type IN ('regular', 'sick', 'duty') AND p_date BETWEEN start_date AND coalesce(end_date, start_date);
  IF v_overlap > 0 THEN RETURN jsonb_build_object('skipped','covered_by_leave'); END IF;

  RETURN jsonb_build_object(
    'date', p_date,
    'units', units,
    'parts', parts,
    'midnight_verified', v_midnight_verified,
    'status', CASE WHEN units = 0 THEN 'present' ELSE 'uncovered_shifts' END
  );
END $function$;

-- 4. تحديث دالة الكشك kiosk_get_employees لإرجاع أوقات الدوام المزحفة الفعالة لليوم
CREATE OR REPLACE FUNCTION public.kiosk_get_employees(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_clean_code text := trim(upper(p_code));
    v_device public.kiosk_devices%ROWTYPE;
    v_eff record;
BEGIN
    IF NOT public.kiosk_device_check(v_clean_code) THEN
        RETURN jsonb_build_object('success', false, 'message', 'رمز التفعيل غير صالح أو الجهاز موقوف');
    END IF;

    SELECT * INTO v_device FROM public.kiosk_devices WHERE activation_code = v_clean_code;
    IF v_device.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'الجهاز غير موجود');
    END IF;

    UPDATE public.kiosk_devices SET last_seen_at = now() WHERE id = v_device.id;

    SELECT * INTO v_eff
    FROM public.get_effective_work_hours((clock_timestamp() AT TIME ZONE 'Asia/Baghdad')::date, v_device.governorate);

    RETURN jsonb_build_object(
        'success', true,
        'device_governorate', v_device.governorate,
        'device_name', v_device.name,
        'employees', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', p.id,
                'full_name', p.full_name,
                'job_number', p.job_number,
                'governorate', p.governorate,
                'department_id', p.department_id,
                'department_name', COALESCE(d.name, 'غير محدد'),
                'dept_text', COALESCE(NULLIF(p.dept_text, ''), d.name, 'غير محدد'),
                'section_text', COALESCE(NULLIF(p.section_text, ''), (
                    CASE WHEN d.level = 4 THEN d.name ELSE '' END
                )),
                'unit_text', COALESCE(p.unit_text, ''),
                'schedule_name', ws.name,
                'today_start', CASE
                    WHEN v_eff.id IS NOT NULL AND COALESCE(ws.type, '') <> 'special' THEN
                        CASE
                            WHEN COALESCE(wsd.is_morning, false) AND COALESCE(wsd.is_night, false) THEN v_eff.morning_start
                            WHEN COALESCE(wsd.is_night, false) THEN v_eff.night_start
                            WHEN COALESCE(wsd.is_evening, false) THEN v_eff.evening_start
                            ELSE v_eff.morning_start
                        END
                    ELSE wsd.start_time
                END,
                'today_end', CASE
                    WHEN v_eff.id IS NOT NULL AND COALESCE(ws.type, '') <> 'special' THEN
                        CASE
                            WHEN COALESCE(wsd.is_night, false) THEN v_eff.night_end
                            WHEN COALESCE(wsd.is_evening, false) THEN v_eff.evening_end
                            ELSE v_eff.morning_end
                        END
                    ELSE wsd.end_time
                END,
                'today_rest', COALESCE(wsd.is_rest_day, true),
                'today_is_evening', COALESCE(wsd.is_evening, false),
                'today_is_night', COALESCE(wsd.is_night, false),
                'face_descriptor', p.face_descriptor,
                'assigned_location_ids', COALESCE((
                    WITH RECURSIVE managed_depts AS (
                        SELECT dept.id, dept.parent_id
                        FROM public.departments dept
                        WHERE dept.manager_id = p.id OR dept.deputy_manager_id = p.id
                        UNION ALL
                        SELECT c.id, c.parent_id
                        FROM public.departments c
                        JOIN managed_depts md ON c.parent_id = md.id
                    ),
                    all_authorized_depts AS (
                        SELECT id FROM managed_depts
                        UNION
                        SELECT parent_id AS id FROM managed_depts WHERE parent_id IS NOT NULL
                    ),
                    all_locs AS (
                        SELECT wle.location_id
                        FROM public.work_location_employees wle
                        WHERE wle.employee_id = p.id
                        UNION
                        SELECT wl.id AS location_id
                        FROM public.work_locations wl
                        WHERE wl.department_id IN (SELECT id FROM all_authorized_depts)
                          AND wl.is_active = true
                    )
                    SELECT jsonb_agg(DISTINCT location_id)
                    FROM all_locs
                    WHERE location_id IS NOT NULL
                ), '[]'::jsonb)
            ))
            FROM public.profiles p
            LEFT JOIN public.departments d ON d.id = p.department_id
            LEFT JOIN public.work_schedules ws ON ws.id = p.work_schedule_id
            LEFT JOIN public.work_schedule_days wsd
                   ON wsd.schedule_id = p.work_schedule_id
                  AND wsd.day_of_week = (EXTRACT(DOW FROM (clock_timestamp() AT TIME ZONE 'Asia/Baghdad'))::int)
            WHERE p.face_descriptor IS NOT NULL
              AND COALESCE(p.role, 'employee') NOT IN ('visitor', 'kiosk')
              AND p.governorate = v_device.governorate
        ), '[]'::jsonb)
    );
END;
$function$;
