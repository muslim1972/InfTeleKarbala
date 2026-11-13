-- =====================================================================
-- morning_shift_daily_evaluator.sql
-- محرك الفحص اليومي للشفت الصباحي والإشعارات المزدوجة عند الساعة 23:59
-- النواة المعمارية: BE-ATT-04 (Roster & Daily Attendance Rules Engine)
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

-- 4. المحرك السيادي للفحص اليومي للشفت الصباحي عند 23:59
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
  v_real_punches jsonb;
  v_earliest_punch timestamptz;
  v_punch_time time;
  v_punch_time_str text;
  v_delay_minutes int;
  v_emp_tri_name text;
  v_sup_id uuid;
  v_notif_emp_content text;
  v_notif_sup_content text;
  v_eval_type text;
  v_day_names text[] := ARRAY['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  
  -- عدادات الإحصاء للتقرير
  v_total_evaluated int := 0;
  v_on_time_count int := 0;
  v_delayed_count int := 0;
  v_after_hours_count int := 0;
  v_absent_count int := 0;
  v_notifications_sent int := 0;
BEGIN
  -- صمام أمان نهاري: منع تشغيل الفحص النهاري التلقائي أثناء ساعات الدوام إذا لم يُمرر تاريخ صريح في الماضي
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
  
  -- صياغة عبارة الموعد القانوني للاستيضاح
  IF v_next_work_date = p_date + 1 THEN
    v_deadline_phrase := 'من يوم غد ' || v_next_date_str;
  ELSE
    v_deadline_phrase := 'من يوم ' || v_day_name_ar || ' ' || v_next_date_str;
  END IF;

  -- التكرار على جميع الموظفين المطالبين بالشفت الصباحي لهذا اليوم:
  -- أ. الموظفون الصباحيون (ليسوا مناوبين)
  -- ب. الموظفون المناوبون الذين لديهم شفت صباحي مجدول لهذا اليوم
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
      -- استبعاد الحسابات الوهمية أو الملغاة
      p.id IS NOT NULL
      AND (
        -- الحالة أ: دوام صباحي اعتيادي
        (
          (ws.id IS NULL OR ws.type <> 'roster' AND COALESCE(ws.name, '') NOT ILIKE '%مناوب%' AND COALESCE(ws.name, '') NOT ILIKE '%خفر%')
          -- الصباحي الاعتيادي يُستثنى في عطلة نهاية الأسبوع (الجمعة والسبت)
          AND EXTRACT(DOW FROM p_date)::int NOT IN (5, 6)
          -- والصباحي الاعتيادي يُستثنى في العطل الرسمية
          AND NOT EXISTS (
            SELECT 1 FROM public.official_holidays h
            WHERE p_date >= h.start_date AND p_date <= h.end_date
          )
        )
        OR
        -- الحالة ب: مناوب ولديه شفت صباحي مجدول اليوم وليس في استراحة
        (
          (ws.type = 'roster' OR COALESCE(ws.name, '') ILIKE '%مناوب%' OR COALESCE(ws.name, '') ILIKE '%خفر%')
          AND COALESCE(wsd.is_morning, false) = true
          AND COALESCE(wsd.is_rest_day, false) = false
        )
      )
      -- استبعاد من لديهم إجازة معتمدة (اعتيادية، مرضية، واجب، إيفاد) تغطي هذا اليوم
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
      ORDER BY check_in ASC NULLS LAST
      LIMIT 1;

      -- استخراج أول بصمة حقيقية (استبعاد البصمات الافتراضية)
      v_earliest_punch := NULL;
      
      IF v_att.id IS NOT NULL AND v_att.raw_punches IS NOT NULL AND jsonb_array_length(v_att.raw_punches) > 0 THEN
        SELECT (punch->>'time')::timestamptz INTO v_earliest_punch
        FROM jsonb_array_elements(v_att.raw_punches) AS punch
        WHERE COALESCE((punch->>'is_virtual')::boolean, false) = false
          AND COALESCE(punch->>'notes', '') NOT LIKE '%افتراضي%'
          AND ((punch->>'time')::timestamptz AT TIME ZONE 'Asia/Baghdad')::date = p_date
        ORDER BY (punch->>'time')::timestamptz ASC
        LIMIT 1;
      END IF;

      -- احتياط: إذا لم نجد في raw_punches، نتحقق من check_in الأصلي
      IF v_earliest_punch IS NULL AND v_att.check_in IS NOT NULL THEN
        IF COALESCE(v_att.check_out_is_virtual, false) = false AND COALESCE(v_att.notes, '') NOT LIKE '%افتراضي%' THEN
          IF ((v_att.check_in AT TIME ZONE 'Asia/Baghdad')::date = p_date) THEN
            v_earliest_punch := v_att.check_in;
          END IF;
        END IF;
      END IF;

      -- =================================================================
      -- تقييم الحالات الأربع الصباحية:
      -- =================================================================

      IF v_earliest_punch IS NOT NULL THEN
        v_punch_time := (v_earliest_punch AT TIME ZONE 'Asia/Baghdad')::time;
        v_punch_time_str := to_char(v_earliest_punch AT TIME ZONE 'Asia/Baghdad', 'HH24:MI');

        -- الحالة 1: بصمة في الموعد (<= 08:30)
        IF v_punch_time <= '08:30:00'::time THEN
          v_on_time_count := v_on_time_count + 1;
          
          -- تثبيت البصمة في السجل دون أي إشعار أو إجراء جزائي
          IF v_att.check_in IS NULL THEN
            UPDATE public.attendance_records
            SET check_in = v_earliest_punch,
                status = 'present'
            WHERE id = v_att.id;
          END IF;

        -- الحالة 2: تأخير عن الدوام الصباحي (> 08:30 ولغاية 14:30)
        ELSIF v_punch_time > '08:30:00'::time AND v_punch_time <= '14:30:00'::time THEN
          v_delayed_count := v_delayed_count + 1;
          v_eval_type := 'morning_delay';
          
          -- حساب الفرق بالدقائق من 08:30
          v_delay_minutes := floor(EXTRACT(EPOCH FROM (v_punch_time - '08:30:00'::time)) / 60)::int;
          IF v_delay_minutes < 1 THEN v_delay_minutes := 1; END IF;

          v_notif_emp_content := 'إن لديك تأخير عن الدوام الرسمي بتاريخ ' || v_date_str || 
            ' بمقدار (' || v_delay_minutes || ' دقيقة) بدون عذر رسمي ، لذا توجب عليك تقديم إستيضاح مكتوب إلى المسؤول المباشر خلال 24 ساعة تنتهي عند 10:30 ' || 
            v_deadline_phrase || ' لتجنب اتخاذ الإجراء الرسمي بحقك';

          v_notif_sup_content := 'أن الموظف ' || v_emp_tri_name || ' ، لديه بصمة متأخرة ليوم ' || 
            v_date_str || ' بمقدار (' || v_delay_minutes || ' دقيقة) ، وتم إشعاره بضرورة تقديم استيضاح خلال 24 ساعة تنتهي عند 10:30 ' || 
            v_deadline_phrase;

          -- إرسال الإشعار للموظف (مع حماية عدم التكرار Idempotency)
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
              'تنبيه تأخر عن الدوام الرسمي',
              v_notif_emp_content,
              false,
              jsonb_build_object('type', 'morning_attendance_alert', 'eval_type', v_eval_type, 'record_date', p_date::text, 'delay_minutes', v_delay_minutes)
            );
            v_notifications_sent := v_notifications_sent + 1;
          END IF;

          -- إرسال الإشعار للمسؤول المباشر
          IF v_sup_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.system_notifications
            WHERE recipient_id = v_sup_id
              AND (metadata->>'record_date') = p_date::text
              AND (metadata->>'employee_id') = v_emp.id::text
              AND (metadata->>'eval_type') = v_eval_type
          ) THEN
            INSERT INTO public.system_notifications(recipient_id, type, title, content, is_read, metadata)
            VALUES (
              v_sup_id,
              'attendance_morning_delay_supervisor',
              'إشعار تأخر موظف في قسمك',
              v_notif_sup_content,
              false,
              jsonb_build_object('type', 'morning_attendance_alert', 'eval_type', v_eval_type, 'record_date', p_date::text, 'employee_id', v_emp.id, 'delay_minutes', v_delay_minutes)
            );
            v_notifications_sent := v_notifications_sent + 1;
          END IF;

        -- الحالة 3: أول بصمة بعد نهاية الشفت الصباحي (> 14:30)
        ELSE
          v_after_hours_count := v_after_hours_count + 1;
          v_eval_type := 'morning_punch_after_hours';

          v_notif_emp_content := 'إن لديك تغيب عن الدوام الرسمي بتاريخ ' || v_date_str || 
            ' مع وجود بصمة اولى بعد وقت الدوام الرسمي عند الساعة ' || v_punch_time_str || 
            ' بدون عذر رسمي ، لذا توجب عليك تقديم إستيضاح مكتوب إلى المسؤول المباشر خلال 24 ساعة تنتهي عند 10:30 ' || 
            v_deadline_phrase || ' لتجنب اتخاذ الإجراء الرسمي بحقك';

          v_notif_sup_content := 'أن الموظف ' || v_emp_tri_name || ' ، لديه بصمة خارج وقت الدوام الرسمي للشفت الصباحي ليوم ' || 
            v_date_str || ' عند الساعة ' || v_punch_time_str || 
            ' ، وتم إشعاره باعتباره متغيبا وابلغ بضرورة تقديم استيضاح خلال 24 ساعة تنتهي عند 10:30 ' || 
            v_deadline_phrase;

          -- إرسال الإشعار للموظف
          IF NOT EXISTS (
            SELECT 1 FROM public.system_notifications
            WHERE recipient_id = v_emp.id
              AND (metadata->>'record_date') = p_date::text
              AND (metadata->>'eval_type') = v_eval_type
          ) THEN
            INSERT INTO public.system_notifications(recipient_id, type, title, content, is_read, metadata)
            VALUES (
              v_emp.id,
              'attendance_morning_absence_after_hours',
              'إشعار تغيب وبصمة بعد نهاية الدوام',
              v_notif_emp_content,
              false,
              jsonb_build_object('type', 'morning_attendance_alert', 'eval_type', v_eval_type, 'record_date', p_date::text, 'punch_time', v_punch_time_str)
            );
            v_notifications_sent := v_notifications_sent + 1;
          END IF;

          -- إرسال الإشعار للمسؤول المباشر
          IF v_sup_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.system_notifications
            WHERE recipient_id = v_sup_id
              AND (metadata->>'record_date') = p_date::text
              AND (metadata->>'employee_id') = v_emp.id::text
              AND (metadata->>'eval_type') = v_eval_type
          ) THEN
            INSERT INTO public.system_notifications(recipient_id, type, title, content, is_read, metadata)
            VALUES (
              v_sup_id,
              'attendance_morning_absence_after_hours_supervisor',
              'إشعار تغيب موظف (بصمة متأخرة)',
              v_notif_sup_content,
              false,
              jsonb_build_object('type', 'morning_attendance_alert', 'eval_type', v_eval_type, 'record_date', p_date::text, 'employee_id', v_emp.id, 'punch_time', v_punch_time_str)
            );
            v_notifications_sent := v_notifications_sent + 1;
          END IF;

        END IF;

      -- الحالة 4: لا توجد أي بصمة للموظف طوال اليوم حتى 23:59
      ELSE
        v_absent_count := v_absent_count + 1;
        v_eval_type := 'morning_total_absence';

        v_notif_emp_content := 'إن لديك تغيب عن الدوام الرسمي بتاريخ ' || v_date_str || 
          ' بدون عذر رسمي ، لذا توجب عليك تقديم إستيضاح مكتوب إلى المسؤول المباشر خلال 24 ساعة تنتهي عند 10:30 ' || 
          v_deadline_phrase || ' لتجنب اتخاذ الإجراء الرسمي بحقك';

        v_notif_sup_content := 'أن الموظف ' || v_emp_tri_name || ' ، ليس لديه بصمة للشفت الصباحي ليوم ' || 
          v_date_str || ' ، وتم إشعاره باعتباره متغيبا وابلغ بضرورة تقديم استيضاح خلال 24 ساعة تنتهي عند 10:30 ' || 
          v_deadline_phrase;

        -- إرسال الإشعار للموظف
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
            v_notif_emp_content,
            false,
            jsonb_build_object('type', 'morning_attendance_alert', 'eval_type', v_eval_type, 'record_date', p_date::text)
          );
          v_notifications_sent := v_notifications_sent + 1;
        END IF;

        -- إرسال الإشعار للمسؤول المباشر
        IF v_sup_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM public.system_notifications
          WHERE recipient_id = v_sup_id
            AND (metadata->>'record_date') = p_date::text
            AND (metadata->>'employee_id') = v_emp.id::text
            AND (metadata->>'eval_type') = v_eval_type
        ) THEN
          INSERT INTO public.system_notifications(recipient_id, type, title, content, is_read, metadata)
          VALUES (
            v_sup_id,
            'attendance_morning_absence_supervisor',
            'إشعار تغيب موظف في قسمك',
            v_notif_sup_content,
            false,
            jsonb_build_object('type', 'morning_attendance_alert', 'eval_type', v_eval_type, 'record_date', p_date::text, 'employee_id', v_emp.id)
          );
          v_notifications_sent := v_notifications_sent + 1;
        END IF;

      END IF;

    EXCEPTION WHEN OTHERS THEN
      -- عزل أخطاء أي موظف شاذ حتى لا يتوقف فحص باقي موظفي المديرية
      RAISE WARNING 'فشل فحص موظف % ليوم %: %', v_emp.id, p_date, SQLERRM;
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
    'after_hours', v_after_hours_count,
    'absent', v_absent_count,
    'notifications_sent', v_notifications_sent
  );
END;
$$;

-- 5. غلاف الاستدعاء للمشرفين والمسؤولين للفحص اليدوي أو التشخيصي
CREATE OR REPLACE FUNCTION public.rpc_evaluate_morning_shift_attendance(
  p_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_target_date date;
  v_caller uuid := auth.uid();
  v_is_admin boolean;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يلزم تسجيل الدخول';
  END IF;

  SELECT (role = 'admin' OR admin_role IN ('biometric', 'attendance_supervisor', 'general', 'developer', 'it_supervisor'))
  INTO v_is_admin
  FROM public.profiles
  WHERE id = v_caller;

  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'صلاحيات غير كافية لتشغيل فحص الدوام الصباحي';
  END IF;

  v_target_date := COALESCE(p_date, (now() AT TIME ZONE 'Asia/Baghdad')::date);
  RETURN public.evaluate_morning_shift_daily_attendance(v_target_date);
END;
$$;

-- ضبط الأذونات السيادية
REVOKE ALL ON FUNCTION public.evaluate_morning_shift_daily_attendance(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.evaluate_morning_shift_daily_attendance(date) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.rpc_evaluate_morning_shift_attendance(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_evaluate_morning_shift_attendance(date) TO authenticated;

-- جدولة المهمة اليومية عند الساعة 23:59 بتوقيت بغداد (20:59 بتوقيت خادم UTC) عبر pg_cron (إن وُجد)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- حذف أي جدولة سابقة بنفس الاسم
    PERFORM cron.unschedule('morning_shift_evaluation_2359')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'morning_shift_evaluation_2359');

    PERFORM cron.unschedule('evaluate_morning_shift_daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'evaluate_morning_shift_daily');

    -- جدولة عند 20:59 UTC يومياً (تطابق 23:59:00 تماماً بتوقيت بغداد الشتوي/الصيفي UTC+3)
    PERFORM cron.schedule(
      'evaluate_morning_shift_daily',
      '59 20 * * *',
      'SELECT public.evaluate_morning_shift_daily_attendance();'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron غير متاح أو تطلب صلاحيات عليا: %', SQLERRM;
END $$;
