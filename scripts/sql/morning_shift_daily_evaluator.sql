-- =====================================================================
-- morning_shift_daily_evaluator.sql
-- محرك الفحص والتشخيص اليومي للشفت الصباحي والتبليغات الرسمية
-- النواة المعمارية: BE-ATT-04 (Roster & Daily Attendance Rules Engine)
-- 
-- الضوابط المقررة من الإدارة:
-- 1. التطبيق جهة رصد وتشخيص وتبليغ فقط، ومجرد تماماً من سلطة إصدار أو تحويل إجازات إجبارية.
-- 2. استيعاب البصمات حتى 6 بصمات، وما بعدها يحل محل السادسة في الانصراف.
-- 3. فحص التأخير الصباحي بعد 8:30، والمغادرة المبكرة قبل 14:30.
-- 4. إغلاق اليوم عند غياب الانصراف ببصمة افتراضية عند 15:00.
-- 5. فحص الإجازة الزمنية وتطبيق قاعدة حصر البصمات داخل وقت الزمنية.
-- 6. تشخيص المغادرات غير المبررة مع دمج الإشعارين عند وجود مغادرتين.
-- 7. تخطي الجمع والسبت والعطل الرسمية والإجازات المعتمدة.
-- =====================================================================

-- 1. دالة استخراج الاسم الثلاثي للموظف بدقة
CREATE OR REPLACE FUNCTION public.extract_tripartite_name(p_full_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_words text[];
  v_clean text;
BEGIN
  IF p_full_name IS NULL OR trim(p_full_name) = '' THEN
    RETURN 'الموظف';
  END IF;
  
  v_clean := regexp_replace(trim(p_full_name), '\s+', ' ', 'g');
  v_words := string_to_array(v_clean, ' ');
  
  IF array_length(v_words, 1) <= 3 THEN
    RETURN v_clean;
  ELSE
    RETURN v_words[1] || ' ' || v_words[2] || ' ' || v_words[3];
  END IF;
END;
$$;

-- 2. دالة حساب يوم الدوام الرسمي القادم (تخطي الجمع والسبت والعطل الرسمية وحدود الشهور)
CREATE OR REPLACE FUNCTION public.get_next_official_work_day(p_date date)
RETURNS date
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_target date := p_date + 1;
  v_dow int;
  v_is_holiday boolean;
BEGIN
  LOOP
    v_dow := EXTRACT(DOW FROM v_target)::int; -- 0=الأحد, 1=الإثنين, ..., 5=الجمعة, 6=السبت
    
    -- تخطي عطلة نهاية الأسبوع (الجمعة والسبت)
    IF v_dow IN (5, 6) THEN
      v_target := v_target + 1;
      CONTINUE;
    END IF;
    
    -- تخطي العطل الرسمية المسجلة في جدول official_holidays
    SELECT EXISTS (
      SELECT 1 FROM public.official_holidays
      WHERE v_target >= start_date AND v_target <= end_date
    ) INTO v_is_holiday;
    
    IF v_is_holiday THEN
      v_target := v_target + 1;
      CONTINUE;
    END IF;
    
    -- تم الوصول لأول يوم دوام رسمي فعلي
    EXIT;
  END LOOP;
  
  RETURN v_target;
END;
$$;

-- 3. دالة استخراج المسؤول المباشر للموظف هرمياً
CREATE OR REPLACE FUNCTION public.get_direct_supervisor_id(p_emp_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_dept_id uuid;
  v_curr_dept uuid;
  v_visited uuid[] := '{}';
  v_mgr uuid;
  v_parent uuid;
  v_gov text;
  v_fallback uuid;
BEGIN
  SELECT department_id, governorate INTO v_dept_id, v_gov
  FROM public.profiles WHERE id = p_emp_id;
  
  IF v_dept_id IS NOT NULL THEN
    v_curr_dept := v_dept_id;
    WHILE v_curr_dept IS NOT NULL AND NOT (v_curr_dept = ANY(v_visited)) LOOP
      v_visited := array_append(v_visited, v_curr_dept);
      SELECT manager_id, parent_id INTO v_mgr, v_parent
      FROM public.departments WHERE id = v_curr_dept;
      
      IF v_mgr IS NOT NULL AND v_mgr <> p_emp_id THEN
        RETURN v_mgr;
      END IF;
      v_curr_dept := v_parent;
    END LOOP;
  END IF;
  
  -- بديل احتياطي: مسؤول البصمة أو الإشراف العام في نفس المحافظة
  SELECT id INTO v_fallback
  FROM public.profiles
  WHERE admin_role IN ('biometric', 'attendance_supervisor', 'general')
    AND id <> p_emp_id
    AND (governorate IS NOT DISTINCT FROM v_gov OR v_gov IS NULL)
  ORDER BY CASE admin_role 
    WHEN 'biometric' THEN 1 
    WHEN 'attendance_supervisor' THEN 2 
    ELSE 3 END
  LIMIT 1;
  
  RETURN v_fallback;
END;
$$;

-- 4. المحرك السيادي للفحص اليومي للشفت الصباحي عند 23:59 أو بأثر رجعي
CREATE OR REPLACE FUNCTION public.evaluate_morning_shift_daily_attendance(
  p_date date DEFAULT ((now() AT TIME ZONE 'Asia/Baghdad') - INTERVAL '2 hours')::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_next_work_date date;
  v_date_str text;
  v_next_date_str text;
  v_deadline_phrase text;
  v_dow int;
  v_day_name_ar text;
  v_emp record;
  v_att record;
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
  v_day_names text[] := ARRAY['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  
  -- عدادات الإحصاء
  v_total_evaluated int := 0;
  v_on_time_count int := 0;
  v_delayed_count int := 0;
  v_early_leave_count int := 0;
  v_absent_count int := 0;
  v_notifications_sent int := 0;
BEGIN
  -- صمام أمان نهاري: منع تشغيل الفحص النهاري التلقائي أثناء ساعات الدوام إذا طُلب لليوم الحالي
  IF (now() AT TIME ZONE 'Asia/Baghdad')::time BETWEEN '06:00:00'::time AND '20:00:00'::time 
     AND p_date = (now() AT TIME ZONE 'Asia/Baghdad')::date THEN
    RAISE EXCEPTION 'لا يمكن تشغيل فحص الإغلاق الصباحي التلقائي نهاراً أثناء ساعات الدوام الفعلي (الوقت الحالي في بغداد: %)', (now() AT TIME ZONE 'Asia/Baghdad')::time;
  END IF;

  -- حساب يوم الدوام الرسمي القادم
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

  -- التكرار على جميع موظفي الشفت الصباحي
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
        -- دوام صباحي اعتيادي (غير مناوب)
        (
          (ws.id IS NULL OR ws.type <> 'roster' AND COALESCE(ws.name, '') NOT ILIKE '%مناوب%' AND COALESCE(ws.name, '') NOT ILIKE '%خفر%')
          AND EXTRACT(DOW FROM p_date)::int NOT IN (5, 6) -- تخطي الجمعة والسبت
          AND NOT EXISTS (
            SELECT 1 FROM public.official_holidays h
            WHERE p_date >= h.start_date AND p_date <= h.end_date
          )
        )
      )
      -- استبعاد من لديهم إجازة يوم كامل معتمدة تغطي هذا اليوم
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

      -- البحث عن سجل الحضور لليوم
      SELECT * INTO v_att 
      FROM public.attendance_records
      WHERE employee_id = v_emp.id
        AND (
          (check_in AT TIME ZONE 'Asia/Baghdad')::date = p_date
          OR (created_at AT TIME ZONE 'Asia/Baghdad')::date = p_date
        )
      ORDER BY created_at DESC
      LIMIT 1;

      -- استخراج البصمات وتطبيق مهلة الـ 3 دقائق (Debounce)
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

      -- الحالة (1): لا توجد أي بصمة طوال اليوم (غياب تام)
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
        -- توجد بصمات: فحص البصمة الأولى والبصمة الأخيرة والبصمات الوسطى
        v_first_punch := v_punches_arr[1];
        v_last_punch := v_punches_arr[v_count];
        v_first_time := ((v_first_punch->>'time')::timestamptz AT TIME ZONE 'Asia/Baghdad')::time;
        v_last_time := ((v_last_punch->>'time')::timestamptz AT TIME ZONE 'Asia/Baghdad')::time;

        -- أ. تقييم وقت الحضور الصباحي
        IF v_first_time <= '08:30:00'::time THEN
          v_on_time_count := v_on_time_count + 1;
        ELSE
          -- تأخير صباحي بعد 8:30
          v_delayed_count := v_delayed_count + 1;
          v_eval_type := 'morning_delay';
          v_delay_mins := floor(EXTRACT(EPOCH FROM (v_first_time - '08:30:00'::time)) / 60)::int;
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

        -- ب. تقييم وقت الانصراف النهائي
        IF v_count = 1 THEN
          -- بصمة واحدة فقط طوال اليوم: حقن بصمة افتراضية حمراء عند 15:00
          v_virtual_iso := (p_date::text || ' 12:00:00+00')::timestamptz; -- 15:00 بغداد
          UPDATE public.attendance_records
          SET check_out = v_virtual_iso,
              check_out_is_virtual = true,
              check_out_virtual_reason = 'خروج افتراضي بنهاية الدوام الصباحي',
              notes = CASE 
                WHEN notes IS NULL OR notes = '' THEN '(خروج نهائي افتراضي 15:00)'
                WHEN notes LIKE '%(خروج نهائي افتراضي 15:00)%' THEN notes
                ELSE notes || ' | (خروج نهائي افتراضي 15:00)'
              END
          WHERE id = v_att.id;
        ELSIF v_count >= 2 THEN
          -- إذا كان الانصراف قبل 14:30 -> مغادرة مبكرة
          IF v_last_time < '14:30:00'::time THEN
            v_early_leave_count := v_early_leave_count + 1;
            v_eval_type := 'morning_early_leave';
            v_early_mins := floor(EXTRACT(EPOCH FROM ('14:30:00'::time - v_last_time)) / 60)::int;
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

        -- ج. تقييم البصمات الوسطى (بين الأولى والأخيرة)
        IF v_count >= 3 THEN
          -- فحص وجود إجازة زمنية معتمدة تغطي اليوم
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
            -- لديه إجازة زمنية معتمدة: فحص العودة المتأخرة بعد نهاية وقت الزمنية
            v_tl_end := v_time_leave.leave_end_time::time;
            -- إذا وُجدت بصمة عودة بعد وقت نهاية الزمنية وقبل الانصراف النهائي
            IF v_count >= 3 THEN
              DECLARE
                v_mid_ret time := ((v_punches_arr[3]->>'time')::timestamptz AT TIME ZONE 'Asia/Baghdad')::time;
                v_ret_late_mins int;
              BEGIN
                IF v_mid_ret > v_tl_end AND v_mid_ret < '14:30:00'::time THEN
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
            -- لا توجد إجازة زمنية: فحص المغادرات غير المبررة
            -- البصمة 2 هي خروج غير مبرر
            v_unjustified_count := 1;
            v_unjustified_first_time := to_char(((v_punches_arr[2]->>'time')::timestamptz AT TIME ZONE 'Asia/Baghdad'), 'HH24:MI');

            -- إذا كان المجموع 5 أو 6 بصمات، فالبصمة 4 هي خروج غير مبرر ثانٍ
            IF v_count >= 5 THEN
              v_unjustified_count := 2;
            END IF;

            IF v_unjustified_count = 1 THEN
              v_eval_type := 'unjustified_exit_single';
              v_notif_content := 'لديك مغادرة غير مبررة عند الساعة (' || v_unjustified_first_time || ') ليوم ' || 
                v_date_str || '، وسيصلك استيضاح ورقي من قبل الإدارة، يرجى التوجه لإداري القسم للإجابة عليه بأسرع وقت.';
            ELSE
              -- دمج المغادرتين في إشعار واحد حتمي
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
$$;

-- ضبط الأذونات السيادية
REVOKE ALL ON FUNCTION public.evaluate_morning_shift_daily_attendance(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.evaluate_morning_shift_daily_attendance(date) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.rpc_evaluate_morning_shift_attendance(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_evaluate_morning_shift_attendance(date) TO authenticated;
