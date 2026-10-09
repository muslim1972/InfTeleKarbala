-- =====================================================================
-- Migration: 20261007190000_overtime_virtual_replacement.sql
-- معالجة استبدال البصمة الافتراضية بالبصمة الحقيقية المتأخرة
-- وحساب الساعات الإضافية وإشعار مسؤول البصمة
-- =====================================================================

CREATE OR REPLACE FUNCTION public.closeout_prev_day_attendance(p_employee_id uuid, p_followup boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
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
  v_is_night boolean;
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
BEGIN
  -- الصلاحيات
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

  -- سجل الأمس (آخر سجل بتاريخ الأمس بتوقيت بغداد)
  SELECT * INTO v_rec
  FROM public.attendance_records
  WHERE employee_id = p_employee_id
    AND (created_at AT TIME ZONE 'Asia/Baghdad')::date = v_prev_date
  ORDER BY created_at DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('action', 'noop', 'date', v_prev_date);
  END IF;

  -- البصمات الحقيقية فقط (استبعاد الافتراضية)
  SELECT COALESCE(jsonb_agg(p ORDER BY (p->>'time')), '[]'::jsonb)
    INTO v_real_punches
  FROM jsonb_array_elements(COALESCE(v_rec.raw_punches, '[]'::jsonb)) p
  WHERE COALESCE((p->>'is_virtual')::boolean, false) = false
    AND COALESCE(p->>'notes', '') NOT LIKE '%افتراضي%';
  v_real_count := jsonb_array_length(v_real_punches);
  IF v_real_count > 0 THEN
    v_last_punch := ((v_real_punches->(v_real_count - 1))->>'time')::timestamptz;
  END IF;

  -- بيانات الموظف
  SELECT full_name, governorate, department_id INTO v_emp
  FROM public.profiles WHERE id = p_employee_id;

  -- جدول أمس لتحديد نهاية الشفت
  v_day_dow := EXTRACT(DOW FROM v_prev_date)::int;
  SELECT ws.id,
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
    v_shift_end := ((v_prev_date + 1)::timestamp + time '08:00') AT TIME ZONE 'Asia/Baghdad';
  ELSE
    v_shift_end_local := COALESCE(v_sched.end_time, time '15:00');
    v_shift_end := (v_prev_date::timestamp + v_shift_end_local) AT TIME ZONE 'Asia/Baghdad';
  END IF;

  -- ─── الحالة الخاصة: وجود بصمة افتراضية سابقة وبصمة حقيقية متأخرة (عدد البصمات الحقيقية زوجي >= 2) ───
  IF (COALESCE(v_rec.check_out_is_virtual, false) = true OR v_rec.notes LIKE '%افتراضي%') AND v_real_count >= 2 THEN
    -- حذف الافتراضية واعتماد البصمة الحقيقية الأخيرة
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
             '\|?\s*\(?خروج نهائي افتراضي\)?', '', 'g'
           ) || CASE WHEN v_ot_note <> '' THEN ' | ' || v_ot_note ELSE '' END,
           updated_at = now()
     WHERE id = v_rec.id
    RETURNING to_jsonb(attendance_records.*) INTO v_result;

    -- إشعار مسؤول البصمة
    IF v_ot_note <> '' THEN
      INSERT INTO public.system_notifications (recipient_id, type, title, content, is_read, metadata)
      SELECT pr.id, 'biometric_alert',
             '⏱️ بصمة انصراف حقيقية متأخرة وساعات إضافية',
             'الموظف (' || COALESCE(v_emp.full_name, '') || ') لديه بصمة انصراف حقيقية بعد نهاية الدوام ليوم ' || v_prev_date::text ||
             ' تم استبدال البصمة الافتراضية بها (' || v_ot_note || '). للعلم والمراجعة.',
             false,
             jsonb_build_object('type', 'overtime_replacement', 'employee_id', p_employee_id,
                                'record_date', v_prev_date, 'last_punch', v_last_punch)
      FROM public.profiles pr
      WHERE pr.id <> p_employee_id
        AND pr.admin_role IN ('biometric', 'general', 'attendance_supervisor')
        AND (v_emp.governorate IS NULL OR pr.governorate = v_emp.governorate);
    END IF;

    RETURN jsonb_build_object('action', 'replaced_virtual_with_real', 'date', v_prev_date, 'record', v_result);
  END IF;

  -- سجل مغلق أصولاً ولا يحتاج إجراء
  IF v_rec.check_out IS NOT NULL OR (v_rec.check_in IS NULL AND v_real_count = 0) THEN
    RETURN jsonb_build_object('action', 'noop', 'date', v_prev_date);
  END IF;

  IF p_followup THEN
    -- استكمال خفر الأمس: الخروج بتوقيت بصمة اليوم (بصمة حقيقية وليست افتراضية)
    UPDATE public.attendance_records
       SET check_out = now(),
           notes = COALESCE(v_rec.notes || ' | ', '') || '(استكمال خفر الأمس: خروج بتوقيت بصمة اليوم)',
           updated_at = now()
     WHERE id = v_rec.id
    RETURNING to_jsonb(attendance_records.*) INTO v_result;
    RETURN jsonb_build_object('action', 'followup_out', 'date', v_prev_date, 'record', v_result);
  END IF;

  IF v_real_count % 2 = 1 OR (v_real_count = 0 AND v_rec.check_in IS NOT NULL) THEN
    -- ─── فردي: الموظف داخل الدوام ولم يثبت بصمة الخروج ───
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

    -- الإشعارات: مسؤولو البصمة + مدير القسم + الموظف (للعلم)
    INSERT INTO public.system_notifications (recipient_id, type, title, content, is_read, metadata)
    SELECT pr.id, 'biometric_alert',
           '🔴 بصمة خروج افتراضية (حمراء)',
           'الموظف (' || COALESCE(v_emp.full_name, '') || ') لم يثبت بصمة خروج ليوم ' || v_prev_date::text ||
           ' (عدد البصمات فردي). وُضعت بصمة افتراضية بنهاية الدوام آلياً — للعلم والمراجعة.',
           false,
           jsonb_build_object('type', 'virtual_red_checkout', 'employee_id', p_employee_id,
                              'record_date', v_prev_date, 'shift_end', v_shift_end)
    FROM public.profiles pr
    WHERE pr.id <> p_employee_id
      AND pr.admin_role IN ('biometric', 'general', 'attendance_supervisor')
      AND (v_emp.governorate IS NULL OR pr.governorate = v_emp.governorate);

    IF v_emp.department_id IS NOT NULL THEN
      INSERT INTO public.system_notifications (recipient_id, type, title, content, is_read, metadata)
      SELECT d.manager_id, 'system',
             '🔴 بصمة خروج افتراضية لموظف في قسمك',
             'الموظف (' || COALESCE(v_emp.full_name, '') || ') لم يثبت بصمة خروج ليوم ' || v_prev_date::text ||
             '. وُضعت بصمة افتراضية بنهاية الدوام آلياً.',
             false,
             jsonb_build_object('type', 'virtual_red_checkout_manager', 'employee_id', p_employee_id, 'record_date', v_prev_date)
      FROM public.departments d
      WHERE d.id = v_emp.department_id AND d.manager_id IS NOT NULL AND d.manager_id <> p_employee_id;
    END IF;

    INSERT INTO public.system_notifications (recipient_id, type, title, content, is_read, metadata)
    VALUES (p_employee_id, 'system',
            '🔴 لم نثبت بصمة خروجك ليوم ' || v_prev_date::text,
            'لم تثبت بصمة خروج ليوم ' || v_prev_date::text || '، ووُضعت بصمة افتراضية بنهاية الدوام آلياً رُصدت لمسؤول البصمة. يرجى الالتزام ببصمة الخروج مستقبلاً.',
            false,
            jsonb_build_object('type', 'virtual_red_checkout_employee', 'record_date', v_prev_date));

    RETURN jsonb_build_object('action', 'virtual_out', 'date', v_prev_date, 'record', v_result);

  ELSE
    -- ─── زوجي: الموظف بالنتيجة خارج المقر ولم يثبت خروجاً نهائياً ───
    UPDATE public.attendance_records
       SET check_out = v_last_punch,
           notes = COALESCE(v_rec.notes || ' | ', '') || '(مغادرة مبكرة: اعتُمدت آخر بصمة كبصمة مغادرة لعدم إثبات خروج نهائي)',
           updated_at = now()
     WHERE id = v_rec.id
    RETURNING to_jsonb(attendance_records.*) INTO v_result;
    RETURN jsonb_build_object('action', 'derived_out', 'date', v_prev_date, 'record', v_result);
  END IF;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.closeout_prev_day_attendance(uuid, boolean) TO authenticated;
