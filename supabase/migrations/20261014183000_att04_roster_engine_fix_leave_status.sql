-- ============================================================
-- BE-ATT-04: تصحيح دالة roster_evaluate_day لتضع leave_status = 'approved'
-- لضمان خصم الأيام المقيدة تلقائياً من رصيد إجازات المناوب في financial_records
-- ============================================================

CREATE OR REPLACE FUNCTION public.roster_evaluate_day(p_emp uuid, p_date date)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_sched uuid; v_type text; v_from date; v_until date;
  d_today record; d_prev record;
  base timestamptz := (p_date::timestamp AT TIME ZONE 'Asia/Baghdad');
  units int := 0; parts text[] := '{}';
  kh1 boolean; prev_kh1 boolean;
  v_leave record; v_overlap int; v_reason text; v_note text; v_name text;
  v_dept uuid; v_gov text; v_mgr uuid; r record; v_created boolean := false; v_id uuid;
BEGIN
  SELECT p.work_schedule_id, p.full_name, p.department_id, p.governorate
    INTO v_sched, v_name, v_dept, v_gov FROM profiles p WHERE p.id = p_emp;
  IF v_sched IS NULL THEN RETURN jsonb_build_object('skipped','no_schedule'); END IF;
  SELECT type, valid_from, valid_until INTO v_type, v_from, v_until FROM work_schedules WHERE id = v_sched;
  IF v_type <> 'roster' OR (v_from IS NOT NULL AND p_date < v_from) OR (v_until IS NOT NULL AND p_date > v_until)
    THEN RETURN jsonb_build_object('skipped','not_roster'); END IF;

  SELECT * INTO d_today FROM work_schedule_days WHERE schedule_id = v_sched AND day_of_week = extract(dow FROM p_date)::int;
  SELECT * INTO d_prev  FROM work_schedule_days WHERE schedule_id = v_sched AND day_of_week = extract(dow FROM p_date - 1)::int;

  -- صباحي 08:00
  IF coalesce(d_today.is_morning,false) AND now() >= base + interval '9 hours'
     AND NOT roster_unit_attended(p_emp, base + interval '8 hours') THEN
    units := units + 1; parts := array_append(parts, 'صباحي'::text); END IF;
  -- مسائي 15:00
  IF coalesce(d_today.is_evening,false) AND now() >= base + interval '16 hours'
     AND NOT roster_unit_attended(p_emp, base + interval '15 hours') THEN
    units := units + 1; parts := array_append(parts, 'مسائي'::text); END IF;
  -- خفر-النصف الأول 20:00
  IF coalesce(d_today.is_night,false) AND now() >= base + interval '21 hours' THEN
    kh1 := roster_unit_attended(p_emp, base + interval '20 hours');
    IF NOT kh1 THEN units := units + 1; parts := array_append(parts, 'خفر (20:00-24:00)'::text); END IF;
  END IF;
  -- خفر-النصف الثاني 00:00 (يتبع خفر الأمس) — مرونة 30د
  IF coalesce(d_prev.is_night,false) AND now() >= base + interval '1 hour' THEN
    prev_kh1 := roster_unit_attended(p_emp, base - interval '4 hours');
    IF NOT prev_kh1 AND NOT roster_unit_attended(p_emp, base, interval '30 minutes') THEN
      units := units + 1; parts := array_append(parts, 'خفر (00:00-08:00)'::text); END IF;
  END IF;

  -- إجازة معتمدة غير إجبارية تغطي اليوم → لا حكم
  SELECT count(*) INTO v_overlap FROM leave_requests
   WHERE user_id = p_emp AND status = 'approved' AND coalesce(is_mandatory,false) = false
     AND leave_type = 'regular' AND p_date BETWEEN start_date AND end_date;
  IF v_overlap > 0 THEN RETURN jsonb_build_object('skipped','covered_by_leave'); END IF;

  SELECT * INTO v_leave FROM leave_requests
   WHERE user_id = p_emp AND is_mandatory = true AND leave_type = 'regular'
     AND start_date = p_date AND end_date = p_date AND status = 'approved' LIMIT 1;

  IF units = 0 THEN
    RETURN jsonb_build_object('date', p_date, 'units', 0, 'existing', v_leave.id);
  END IF;

  v_reason := format('عدم الحضور/التأخر لأكثر من ساعة في: %s — إجازة اعتيادية إجبارية (%s يوم)', array_to_string(parts, ' + '), units);
  v_note := format('إجازة إجبارية %s يوم بسبب التأخير لأكثر من ساعتين، وللإدارة تحويلها إلى غياب', units);

  IF v_leave.id IS NULL THEN
    INSERT INTO leave_requests(user_id, start_date, end_date, days_count, reason, status, leave_status, leave_type, is_mandatory, with_request, notes)
    VALUES (p_emp, p_date, p_date, units, v_reason, 'approved', 'approved', 'regular', true, false, v_note) RETURNING id INTO v_id;
    v_created := true;
  ELSIF v_leave.days_count IS DISTINCT FROM units THEN
    UPDATE leave_requests 
    SET days_count = units, 
        reason = v_reason, 
        notes = v_note,
        status = 'approved',
        leave_status = 'approved'
    WHERE id = v_leave.id;
    v_id := v_leave.id; v_created := true;
  ELSE
    v_id := v_leave.id;
  END IF;

  IF v_created THEN
    SELECT manager_id INTO v_mgr FROM departments WHERE id = v_dept;
    FOR r IN
      SELECT p_emp AS rid UNION
      SELECT id FROM profiles WHERE admin_role IN ('biometric','attendance_supervisor','general') AND governorate IS NOT DISTINCT FROM v_gov
      UNION SELECT v_mgr WHERE v_mgr IS NOT NULL
    LOOP
      INSERT INTO system_notifications(recipient_id, title, content, type, metadata)
      VALUES (r.rid, '⚠️ قرار دوام مناوب آلي',
              format('%s: %s (التاريخ: %s)', v_name, v_reason, p_date),
              'system',
              jsonb_build_object('employee_id', p_emp, 'date', p_date, 'units', units, 'leave_id', v_id));
    END LOOP;
  END IF;

  RETURN jsonb_build_object('date', p_date, 'units', units, 'parts', parts, 'leave_id', v_id);
END $$;

NOTIFY pgrst, 'reload schema';
