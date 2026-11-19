-- ==============================================================================
-- محرك محاسبة وتقييم المناوب (Roster Rules Engine) — تشخيصي بحت، آمن، idempotent
-- مديرية اتصالات كربلاء — إطار عمل B.R.I.C.K (ATT-04)
-- ==============================================================================
-- المبادئ الصارمة:
-- 1. صفر إجازات تلقائية: لا يُنشئ ولا يُعدل قيود إجازة في leave_requests أبداً.
-- 2. التحقق من بصمتي منتصف الليل لشفت الخفر:
--    - إن وُجدتا: حضور مثبت وتأكيد التواجد.
--    - إن فُقدتا: إدراج بصمة افتراضية حمراء في السجل مع تنبيه أصولي للمشرف لمراجعة كاميرات المراقبة.
-- 3. حماية أوزان الشفتات: صباحي=1، مسائي=1، خفر=2، مسائي+خفر=3.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.roster_real_punches(p_emp uuid, p_from timestamptz, p_to timestamptz)
RETURNS TABLE(t timestamptz) LANGUAGE sql STABLE AS $$
  SELECT DISTINCT (e->>'time')::timestamptz
  FROM attendance_records r, jsonb_array_elements(coalesce(r.raw_punches,'[]'::jsonb)) e
  WHERE r.employee_id = p_emp
    AND r.check_in >= p_from - interval '2 days' AND r.check_in <= p_to
    AND coalesce((e->>'is_virtual')::boolean,false) = false
    AND (e->>'time')::timestamptz >= p_from AND (e->>'time')::timestamptz <= p_to
$$;

-- هل حضر الموظف الوحدة [s, s+60د]؟ (بصمة داخلها، أو موجود أصلاً: عدد فردي من البصمات قبلها خلال 24س)
CREATE OR REPLACE FUNCTION public.roster_unit_attended(p_emp uuid, s timestamptz, p_flex interval DEFAULT '0')
RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE n_in int; n_before int;
BEGIN
  SELECT count(*) INTO n_in FROM roster_real_punches(p_emp, s - p_flex, s + interval '60 minutes');
  IF n_in > 0 THEN RETURN true; END IF;
  SELECT count(*) INTO n_before FROM roster_real_punches(p_emp, s - interval '24 hours', s - p_flex);
  RETURN (n_before % 2) = 1;
END $$;

CREATE OR REPLACE FUNCTION public.roster_evaluate_day(p_emp uuid, p_date date)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_sched uuid; v_type text; v_from date; v_until date;
  d_today record; d_prev record;
  base timestamptz := (p_date::timestamp AT TIME ZONE 'Asia/Baghdad');
  units int := 0; parts text[] := '{}';
  kh1 boolean; prev_kh1 boolean;
  v_overlap int; v_name text;
  v_dept uuid; v_gov text; v_mgr uuid; r record;
  v_m_tl int := 0; v_e_tl int := 0; v_n_tl int := 0;
  
  -- متغيرات فحص منتصف الليل لشفت الخفر
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

  -- فحص الإجازات الزمنية المعتمدة (نوع shift_start فقط) للشفتات لليوم المحدد
  SELECT coalesce(max(time_duration_minutes), 0) INTO v_m_tl FROM leave_requests
   WHERE user_id = p_emp AND status = 'approved' AND start_date = p_date
     AND leave_type = 'time_off' AND time_off_subtype = 'shift_start'
     AND (leave_start_time >= '07:00:00' AND leave_start_time < '14:00:00')
     AND coalesce(time_duration_minutes, 0) > 0;

  SELECT coalesce(max(time_duration_minutes), 0) INTO v_e_tl FROM leave_requests
   WHERE user_id = p_emp AND status = 'approved' AND start_date = p_date
     AND leave_type = 'time_off' AND time_off_subtype = 'shift_start'
     AND (leave_start_time >= '14:00:00' AND leave_start_time < '19:30:00')
     AND coalesce(time_duration_minutes, 0) > 0;

  SELECT coalesce(max(time_duration_minutes), 0) INTO v_n_tl FROM leave_requests
   WHERE user_id = p_emp AND status = 'approved' AND start_date = p_date
     AND leave_type = 'time_off' AND time_off_subtype = 'shift_start'
     AND (leave_start_time >= '19:30:00' OR leave_start_time < '07:00:00')
     AND coalesce(time_duration_minutes, 0) > 0;

  -- صباحي 08:00
  IF coalesce(d_today.is_morning,false) THEN
    IF v_m_tl > 0 THEN
      IF now() >= base + interval '8 hours' + (v_m_tl || ' minutes')::interval + interval '60 minutes'
         AND NOT roster_unit_attended(p_emp, base + interval '8 hours' + (v_m_tl || ' minutes')::interval, interval '5 minutes') THEN
        units := units + 1; parts := array_append(parts, 'صباحي'::text);
      END IF;
    ELSIF now() >= base + interval '9 hours' AND NOT roster_unit_attended(p_emp, base + interval '8 hours') THEN
      units := units + 1; parts := array_append(parts, 'صباحي'::text);
    END IF;
  END IF;

  -- مسائي 15:00
  IF coalesce(d_today.is_evening,false) THEN
    IF v_e_tl > 0 THEN
      IF now() >= base + interval '15 hours' + (v_e_tl || ' minutes')::interval + interval '60 minutes'
         AND NOT roster_unit_attended(p_emp, base + interval '15 hours' + (v_e_tl || ' minutes')::interval, interval '5 minutes') THEN
        units := units + 1; parts := array_append(parts, 'مسائي'::text);
      END IF;
    ELSIF now() >= base + interval '16 hours' AND NOT roster_unit_attended(p_emp, base + interval '15 hours') THEN
      units := units + 1; parts := array_append(parts, 'مسائي'::text);
    END IF;
  END IF;

  -- خفر-النصف الأول 20:00
  IF coalesce(d_today.is_night,false) THEN
    IF v_n_tl > 0 THEN
      IF now() >= base + interval '20 hours' + (v_n_tl || ' minutes')::interval + interval '60 minutes' THEN
        kh1 := roster_unit_attended(p_emp, base + interval '20 hours' + (v_n_tl || ' minutes')::interval, interval '5 minutes');
        IF NOT kh1 THEN units := units + 1; parts := array_append(parts, 'خفر (20:00-24:00)'::text); END IF;
      END IF;
    ELSIF now() >= base + interval '21 hours' THEN
      kh1 := roster_unit_attended(p_emp, base + interval '20 hours');
      IF NOT kh1 THEN units := units + 1; parts := array_append(parts, 'خفر (20:00-24:00)'::text); END IF;
    END IF;

    -- فحص شرط بصمة منتصف الليل لشفت الخفر (بين 23:15 و 00:45)
    SELECT count(*) INTO v_midnight_punches
    FROM roster_real_punches(p_emp, base + interval '23 hours 15 minutes', base + interval '24 hours 45 minutes');

    IF v_midnight_punches > 0 THEN
      v_midnight_verified := true;
    ELSIF now() >= base + interval '24 hours' THEN
      -- فُقدت بصمة منتصف الليل: إدراج بصمة افتراضية حمراء وتنبيه المشرف لمراجعة الكاميرات
      SELECT id, raw_punches INTO v_rec_id, v_existing_raw
      FROM attendance_records
      WHERE employee_id = p_emp AND (created_at AT TIME ZONE 'Asia/Baghdad')::date = p_date
      ORDER BY created_at DESC LIMIT 1;

      IF v_rec_id IS NOT NULL THEN
        -- التأكد من عدم تكرار البصمة الافتراضية
        IF NOT (v_existing_raw::text LIKE '%لم يثبت حضور منتصف الليل%') THEN
          UPDATE attendance_records
          SET raw_punches = coalesce(raw_punches, '[]'::jsonb) || jsonb_build_object(
                'time', (base + interval '23 hours 59 minutes 59 seconds')::timestamptz,
                'notes', '(بصمة منتصف ليل افتراضية حمراء - لم يثبت حضور منتصف الليل)',
                'is_virtual', true
              ),
              admin_notes = coalesce(admin_notes || ' | ', '') || 'تنبيه تدقيق: لم يثبت الموظف حضوره عند منتصف الليل لشفت الخفر. يرجى مراجعة الكاميرات للتحقق من التواجد بالمقر.'
          WHERE id = v_rec_id;

          -- إشعار المشرفين للتدقيق عبر الكاميرات
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

  -- خفر-النصف الثاني 00:00 (يتبع خفر الأمس)
  IF coalesce(d_prev.is_night,false) AND now() >= base + interval '1 hour' THEN
    prev_kh1 := roster_unit_attended(p_emp, base - interval '4 hours');
    IF NOT prev_kh1 AND NOT roster_unit_attended(p_emp, base, interval '30 minutes') THEN
      units := units + 1; parts := array_append(parts, 'خفر (00:00-08:00)'::text); END IF;
  END IF;

  -- إجازة معتمدة غير إجبارية تغطي اليوم → لا حكم
  SELECT count(*) INTO v_overlap FROM leave_requests
   WHERE user_id = p_emp AND status = 'approved' AND coalesce(is_mandatory,false) = false
     AND leave_type IN ('regular', 'sick', 'duty') AND p_date BETWEEN start_date AND coalesce(end_date, start_date);
  IF v_overlap > 0 THEN RETURN jsonb_build_object('skipped','covered_by_leave'); END IF;

  -- الناتج تشخيصي بحت دون إدراج أي قيود إجازة في leave_requests
  RETURN jsonb_build_object(
    'date', p_date,
    'units', units,
    'parts', parts,
    'midnight_verified', v_midnight_verified,
    'status', CASE WHEN units = 0 THEN 'present' ELSE 'uncovered_shifts' END
  );
END $$;

CREATE OR REPLACE FUNCTION public.roster_evaluate_all()
RETURNS int LANGUAGE plpgsql AS $$
DECLARE e record; n int := 0; td date := (now() AT TIME ZONE 'Asia/Baghdad')::date;
BEGIN
  FOR e IN SELECT p.id FROM profiles p JOIN work_schedules w ON w.id = p.work_schedule_id WHERE w.type = 'roster' LOOP
    PERFORM roster_evaluate_day(e.id, td - 1);
    PERFORM roster_evaluate_day(e.id, td);
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

-- أمان: الصلاحيات
REVOKE ALL ON FUNCTION public.roster_evaluate_day(uuid,date), public.roster_evaluate_all(), public.roster_unit_attended(uuid,timestamptz,interval), public.roster_real_punches(uuid,timestamptz,timestamptz) FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.roster_evaluate_me() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE td date := (now() AT TIME ZONE 'Asia/Baghdad')::date;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  RETURN jsonb_build_object('yesterday', roster_evaluate_day(auth.uid(), td-1), 'today', roster_evaluate_day(auth.uid(), td));
END $$;
REVOKE ALL ON FUNCTION public.roster_evaluate_me() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.roster_evaluate_me() TO authenticated;
