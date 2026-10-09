-- محرك محاسبة المناوب (Roster) — يعمل داخل قاعدة البيانات، idempotent
-- التوقيت: بغداد UTC+3. بلا سماحية: صباحي 08-15، مسائي 15-20، خفر 20-08.
-- كل وحدة شفت = يوم إجازة؛ الخفر نصفان (20-24 و00-08) = يومان.
-- قيد واحد لكل تاريخ (days_count = عدد وحدات ذلك التاريخ).

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
    INSERT INTO leave_requests(user_id, start_date, end_date, days_count, reason, status, leave_type, is_mandatory, with_request, notes)
    VALUES (p_emp, p_date, p_date, units, v_reason, 'approved', 'regular', true, false, v_note) RETURNING id INTO v_id;
    v_created := true;
  ELSIF v_leave.days_count IS DISTINCT FROM units THEN
    UPDATE leave_requests SET days_count = units, reason = v_reason, notes = v_note WHERE id = v_leave.id;
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
      INSERT INTO system_notifications(recipient_id, type, title, content, metadata)
      VALUES (r.rid, 'attendance_alert', 'إجازة إجبارية (مناوب)',
        format('%s — %s: %s', v_name, p_date, v_note) || ' — ' || array_to_string(parts, ' + '),
        jsonb_build_object('leave_id', v_id, 'roster_engine', true, 'date', p_date, 'units', units));
    END LOOP;
  END IF;
  RETURN jsonb_build_object('date', p_date, 'units', units, 'parts', parts, 'leave_id', v_id);
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

-- أمان: الدوال الداخلية لا تُستدعى من العميل؛ المنتسب يستدعي غلافاً لنفسه فقط
REVOKE ALL ON FUNCTION public.roster_evaluate_day(uuid,date), public.roster_evaluate_all(), public.roster_unit_attended(uuid,timestamptz,interval), public.roster_real_punches(uuid,timestamptz,timestamptz) FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.roster_evaluate_me() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE td date := (now() AT TIME ZONE 'Asia/Baghdad')::date;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  RETURN jsonb_build_object('yesterday', roster_evaluate_day(auth.uid(), td-1), 'today', roster_evaluate_day(auth.uid(), td));
END $$;
REVOKE ALL ON FUNCTION public.roster_evaluate_me() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.roster_evaluate_me() TO authenticated;

