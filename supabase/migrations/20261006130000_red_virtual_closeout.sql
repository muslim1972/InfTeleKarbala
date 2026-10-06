-- =====================================================================
-- البصمة الحمراء الافتراضية + قاعدة الزوجي/الفردي عند إغلاق اليوم
-- وفق flowcharts-attendance-1 (اعتمد 6/10/2026):
--  - عدد بصمات فردي (آخر بصمة دخول/عودة — الموظف داخل الدوام ولم يثبت
--    بصمة خروج): توضع بصمة خروج افتراضية حمراء بنهاية الشفت + إشعار
--    مسؤول البصمة والإدارة والموظف — دون خصم نقص.
--  - عدد بصمات زوجي وآخر بصمة خروج (الموظف بالنتيجة خارج المقر ولم
--    يثبت خروجاً نهائياً): تعتبر آخر بصمة مغادرة مبكرة → تُحاسب
--    بالنقص (زمنية نهاية دوام إن كان المجموع ≤ ساعتين، وإلا اجازة
--    اعتيادية إجبارية) — تنفذ العقوبات في التطبيق بعد الإغلاق.
-- =====================================================================

ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS check_out_is_virtual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS check_out_virtual_reason text;

-- ---------------------------------------------------------------------
-- ترقيع submit_attendance_record_secure: إضافة العمودين الجديدين لقائمة
-- التحديث المسموح (النسخة الحية من قاعدة البيانات + الأعمدة الجديدة)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_attendance_record_secure(p_employee_id uuid, p_record_id uuid DEFAULT NULL::uuid, p_updates jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_caller_id UUID;
    v_is_privileged BOOLEAN := false;
    v_is_kiosk BOOLEAN := false;
    v_result JSONB;
    v_existing_record RECORD;
    v_now TIMESTAMPTZ := clock_timestamp();
    v_today_baghdad DATE := (clock_timestamp() AT TIME ZONE 'Asia/Baghdad')::date;
    v_raw_punches JSONB;
    v_last_punch JSONB;
    v_punch_count INT;
    v_client_time TIMESTAMPTZ;
    v_time_drift_seconds NUMERIC;
    v_security_note TEXT := '';
    v_sanitized_updates JSONB := p_updates;
    v_now_utc_str TEXT := to_char(v_now AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
BEGIN
    v_caller_id := auth.uid();

    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'المستخدم غير مسجل الدخول (Authentication required)';
    END IF;
    -- التحقق من صلاحيات المشرف أو المدير
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = v_caller_id
        AND (
            role IN ('admin', 'hr_manager')
            OR admin_role IN ('general', 'developer')
        )
    ) INTO v_is_privileged;
    -- جلسة كيوسك البصمة: تُصرّح بالتسجيل للموظف المطابق بالوجه فقط عبر جهاز مرمّز
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = v_caller_id AND role = 'kiosk'
    ) INTO v_is_kiosk;
    -- الموظف العادي يعدل ويسجل لنفسه فقط
    IF NOT v_is_privileged AND NOT v_is_kiosk AND v_caller_id <> p_employee_id THEN
        RAISE EXCEPTION 'غير مصرح: لا يمكنك تعديل أو تسجيل حضور لموظف آخر';
    END IF;
    -- ====================================================================
    -- فرض قيود توقيت السيرفر للموظفين العاديين وجلسات الكيوسك
    -- ====================================================================
    IF NOT v_is_privileged OR v_is_kiosk THEN
        -- التأكد من أن السجل القائم يخص تاريخ اليوم
        IF p_record_id IS NOT NULL THEN
            SELECT * INTO v_existing_record
            FROM public.attendance_records
            WHERE id = p_record_id;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'سجل الحضور غير موجود';
            END IF;
            IF NOT v_is_kiosk AND v_existing_record.employee_id <> v_caller_id THEN
                RAISE EXCEPTION 'غير مصرح: هذا السجل لا يخصك';
            END IF;
            IF (v_existing_record.created_at AT TIME ZONE 'Asia/Baghdad')::date <> v_today_baghdad THEN
                RAISE EXCEPTION 'غير مصرح: لا يمكن تعديل أو إضافة بصمات ليوم سابق أو لاحق';
            END IF;
        END IF;
        -- فحص مصفوفة البصمات وضبط وقت البصمة الأخيرة تلقائياً لوقت السيرفر
        IF v_sanitized_updates ? 'raw_punches' AND jsonb_typeof(v_sanitized_updates->'raw_punches') = 'array' THEN
            v_raw_punches := v_sanitized_updates->'raw_punches';
            v_punch_count := jsonb_array_length(v_raw_punches);
            IF v_punch_count > 0 THEN
                v_last_punch := v_raw_punches->(v_punch_count - 1);
                IF v_last_punch ? 'time' THEN
                    BEGIN
                        v_client_time := (v_last_punch->>'time')::timestamptz;
                        v_time_drift_seconds := abs(EXTRACT(EPOCH FROM (v_client_time - v_now)));
                        -- إضافة ملاحظة أمنية إذا كان فارق الوقت أكثر من 90 ثانية
                        IF v_time_drift_seconds >= 90 THEN
                            v_security_note := ' [رصد اختلاف ساعة الجهاز بمقدار ' || round(v_time_drift_seconds) || ' ثانية - اعتُمد توقيت السيرفر الرسمي]';
                        END IF;
                    EXCEPTION WHEN OTHERS THEN
                        v_security_note := ' [صيغة توقيت غير صالحة - اعتُمد توقيت السيرفر الرسمي]';
                    END;
                END IF;
                -- تثبيت وقت البصمة الأخيرة بتوقيت السيرفر الرسمي المحصن
                v_last_punch := jsonb_set(v_last_punch, '{time}', to_jsonb(v_now_utc_str));
                v_raw_punches := jsonb_set(v_raw_punches, ARRAY[(v_punch_count - 1)::text], v_last_punch);
                v_sanitized_updates := jsonb_set(v_sanitized_updates, '{raw_punches}', v_raw_punches);
            END IF;
        END IF;
        -- للسجل الجديد (تسجيل حضور)، فرض وقت السيرفر كـ check_in
        IF p_record_id IS NULL THEN
            IF v_sanitized_updates ? 'check_in' AND v_sanitized_updates->>'check_in' IS NOT NULL THEN
                v_sanitized_updates := jsonb_set(v_sanitized_updates, '{check_in}', to_jsonb(v_now_utc_str));
            END IF;
        ELSE
            -- للسجل القائم:
            IF v_sanitized_updates ? 'check_out' AND v_sanitized_updates->>'check_out' IS NOT NULL THEN
                IF v_existing_record.check_out IS NULL OR (v_sanitized_updates->>'check_out')::timestamptz <> v_existing_record.check_out THEN
                    v_sanitized_updates := jsonb_set(v_sanitized_updates, '{check_out}', to_jsonb(v_now_utc_str));
                END IF;
            END IF;
            IF v_sanitized_updates ? 'time_leave_out' AND v_sanitized_updates->>'time_leave_out' IS NOT NULL THEN
                IF v_existing_record.time_leave_out IS NULL THEN
                    v_sanitized_updates := jsonb_set(v_sanitized_updates, '{time_leave_out}', to_jsonb(v_now_utc_str));
                END IF;
            END IF;
            IF v_sanitized_updates ? 'time_leave_return' AND v_sanitized_updates->>'time_leave_return' IS NOT NULL THEN
                IF v_existing_record.time_leave_return IS NULL THEN
                    v_sanitized_updates := jsonb_set(v_sanitized_updates, '{time_leave_return}', to_jsonb(v_now_utc_str));
                END IF;
            END IF;
        END IF;
        -- إضافة التنبيه الأمني للملاحظات إن وُجد فارق توقيت
        IF v_security_note <> '' THEN
            IF v_sanitized_updates ? 'notes' AND v_sanitized_updates->>'notes' IS NOT NULL THEN
                v_sanitized_updates := jsonb_set(v_sanitized_updates, '{notes}', to_jsonb(v_sanitized_updates->>'notes' || v_security_note));
            ELSE
                v_sanitized_updates := jsonb_set(v_sanitized_updates, '{notes}', to_jsonb(v_security_note));
            END IF;
        END IF;
    END IF;
    -- ====================================================================
    -- تنفيذ التحديث أو الإدراج في جدول الحضور
    -- ====================================================================
    IF p_record_id IS NOT NULL THEN
        UPDATE public.attendance_records
        SET
            check_in = CASE
                WHEN v_sanitized_updates ? 'check_in' THEN (v_sanitized_updates->>'check_in')::timestamptz
                ELSE check_in
            END,
            check_out = CASE
                WHEN v_sanitized_updates ? 'check_out' THEN (v_sanitized_updates->>'check_out')::timestamptz
                ELSE check_out
            END,
            check_in_location = CASE
                WHEN v_sanitized_updates ? 'check_in_location' THEN v_sanitized_updates->>'check_in_location'
                ELSE check_in_location
            END,
            check_out_location = CASE
                WHEN v_sanitized_updates ? 'check_out_location' THEN v_sanitized_updates->>'check_out_location'
                ELSE check_out_location
            END,
            check_in_verified_by_biometric = CASE
                WHEN v_sanitized_updates ? 'check_in_verified_by_biometric' THEN (v_sanitized_updates->>'check_in_verified_by_biometric')::boolean
                ELSE check_in_verified_by_biometric
            END,
            check_out_verified_by_biometric = CASE
                WHEN v_sanitized_updates ? 'check_out_verified_by_biometric' THEN (v_sanitized_updates->>'check_out_verified_by_biometric')::boolean
                ELSE check_out_verified_by_biometric
            END,
            check_in_device_id = CASE
                WHEN v_sanitized_updates ? 'check_in_device_id' THEN v_sanitized_updates->>'check_in_device_id'
                ELSE check_in_device_id
            END,
            check_out_device_id = CASE
                WHEN v_sanitized_updates ? 'check_out_device_id' THEN v_sanitized_updates->>'check_out_device_id'
                ELSE check_out_device_id
            END,
            check_in_snapshot_url = CASE
                WHEN v_sanitized_updates ? 'check_in_snapshot_url' THEN v_sanitized_updates->>'check_in_snapshot_url'
                ELSE check_in_snapshot_url
            END,
            check_out_snapshot_url = CASE
                WHEN v_sanitized_updates ? 'check_out_snapshot_url' THEN v_sanitized_updates->>'check_out_snapshot_url'
                ELSE check_out_snapshot_url
            END,
            time_leave_out = CASE
                WHEN v_sanitized_updates ? 'time_leave_out' THEN (v_sanitized_updates->>'time_leave_out')::timestamptz
                ELSE time_leave_out
            END,
            time_leave_return = CASE
                WHEN v_sanitized_updates ? 'time_leave_return' THEN (v_sanitized_updates->>'time_leave_return')::timestamptz
                ELSE time_leave_return
            END,
            time_leave_out_2 = CASE
                WHEN v_sanitized_updates ? 'time_leave_out_2' THEN (v_sanitized_updates->>'time_leave_out_2')::timestamptz
                ELSE time_leave_out_2
            END,
            time_leave_return_2 = CASE
                WHEN v_sanitized_updates ? 'time_leave_return_2' THEN (v_sanitized_updates->>'time_leave_return_2')::timestamptz
                ELSE time_leave_return_2
            END,
            check_out_is_virtual = CASE
                WHEN v_sanitized_updates ? 'check_out_is_virtual' THEN (v_sanitized_updates->>'check_out_is_virtual')::boolean
                ELSE check_out_is_virtual
            END,
            check_out_virtual_reason = CASE
                WHEN v_sanitized_updates ? 'check_out_virtual_reason' THEN v_sanitized_updates->>'check_out_virtual_reason'
                ELSE check_out_virtual_reason
            END,
            notes = CASE
                WHEN v_sanitized_updates ? 'notes' THEN v_sanitized_updates->>'notes'
                ELSE notes
            END,
            admin_notes = CASE
                WHEN v_sanitized_updates ? 'admin_notes' THEN v_sanitized_updates->>'admin_notes'
                ELSE admin_notes
            END,
            status = CASE
                WHEN v_sanitized_updates ? 'status' THEN v_sanitized_updates->>'status'
                ELSE status
            END,
            is_device_pending = CASE
                WHEN v_sanitized_updates ? 'is_device_pending' THEN (v_sanitized_updates->>'is_device_pending')::boolean
                ELSE is_device_pending
            END,
            raw_punches = CASE
                WHEN v_sanitized_updates ? 'raw_punches' THEN v_sanitized_updates->'raw_punches'
                ELSE raw_punches
            END,
            overtime_minutes = CASE
                WHEN v_sanitized_updates ? 'overtime_minutes' THEN (v_sanitized_updates->>'overtime_minutes')::integer
                ELSE overtime_minutes
            END,
            updated_at = v_now
        WHERE id = p_record_id
        RETURNING to_jsonb(attendance_records.*) INTO v_result;
    ELSE
        INSERT INTO public.attendance_records (
            employee_id,
            department_id,
            work_schedule_id,
            check_in,
            check_out,
            check_in_location,
            check_out_location,
            check_in_verified_by_biometric,
            check_out_verified_by_biometric,
            check_in_device_id,
            check_out_device_id,
            check_in_snapshot_url,
            check_out_snapshot_url,
            time_leave_out,
            time_leave_return,
            time_leave_out_2,
            time_leave_return_2,
            notes,
            status,
            is_device_pending,
            raw_punches,
            overtime_minutes,
            created_at,
            updated_at
        ) VALUES (
            p_employee_id,
            NULLIF(v_sanitized_updates->>'department_id', '')::uuid,
            NULLIF(v_sanitized_updates->>'work_schedule_id', '')::uuid,
            (v_sanitized_updates->>'check_in')::timestamptz,
            (v_sanitized_updates->>'check_out')::timestamptz,
            v_sanitized_updates->>'check_in_location',
            v_sanitized_updates->>'check_out_location',
            COALESCE((v_sanitized_updates->>'check_in_verified_by_biometric')::boolean, false),
            COALESCE((v_sanitized_updates->>'check_out_verified_by_biometric')::boolean, false),
            v_sanitized_updates->>'check_in_device_id',
            v_sanitized_updates->>'check_out_device_id',
            v_sanitized_updates->>'check_in_snapshot_url',
            v_sanitized_updates->>'check_out_snapshot_url',
            (v_sanitized_updates->>'time_leave_out')::timestamptz,
            (v_sanitized_updates->>'time_leave_return')::timestamptz,
            (v_sanitized_updates->>'time_leave_out_2')::timestamptz,
            (v_sanitized_updates->>'time_leave_return_2')::timestamptz,
            v_sanitized_updates->>'notes',
            COALESCE(v_sanitized_updates->>'status', 'present'),
            COALESCE((v_sanitized_updates->>'is_device_pending')::boolean, false),
            COALESCE(v_sanitized_updates->'raw_punches', '[]'::jsonb),
            COALESCE((v_sanitized_updates->>'overtime_minutes')::integer, 0),
            v_now,
            v_now
        )
        RETURNING to_jsonb(attendance_records.*) INTO v_result;
    END IF;
    RETURN v_result;
END;
$function$;

-- ---------------------------------------------------------------------
-- إغلاق سجل يوم أمس المفتوح وفق قاعدة الزوجي/الفردي
-- تُستدعى كسولياً من التطبيق عند أول بصمة في يوم جديد، ولاحقاً من
-- مهمة pg_cron عند منتصف الليل.
-- p_followup=true: استكمال خفر الأمس (بصمة اليوم ≤ 12 ظهراً تكمل
--   خفر أمس) → خروج الأمس بتوقيت بصمة اليوم (بصمة حقيقية).
-- SECURITY DEFINER لأن السجل يعود ليوم سابق ولا يمكن للموظف تعديله
-- مباشرة عبر submit_attendance_record_secure (حماية توقيت السيرفر).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.closeout_prev_day_attendance(p_employee_id uuid, p_followup boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_caller uuid := auth.uid();
  v_is_privileged boolean;
  v_is_kiosk boolean;
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
BEGIN
  -- الصلاحيات: صاحب السجل نفسه، أو جلسة كيوسك، أو مميز
  -- (الاتصال المباشر بحساب postgres — بلا جلسة — مسموح لمهمة pg_cron والصيانة السيرفيرية)
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
    v_last_punch := (v_real_punches->(v_real_count - 1))->>'time';
  END IF;

  -- سجل مفتوح = له حضور (بصمات أو دخول) بلا خروج
  IF v_rec.check_out IS NOT NULL OR (v_rec.check_in IS NULL AND v_real_count = 0) THEN
    RETURN jsonb_build_object('action', 'noop', 'date', v_prev_date);
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
    -- بصمة خروج افتراضية حمراء بنهاية الشفت (خفر: 08:00 ص من اليوم التالي)
    IF v_is_night THEN
      v_shift_end := ((v_prev_date + 1)::timestamp + time '08:00') AT TIME ZONE 'Asia/Baghdad';
    ELSE
      v_shift_end_local := COALESCE(v_sched.end_time, time '15:00');
      v_shift_end := (v_prev_date::timestamp + v_shift_end_local) AT TIME ZONE 'Asia/Baghdad';
    END IF;
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
    -- آخر بصمة حقيقية = مغادرة مبكرة (العقوبات تنفذ في التطبيق بعدها)
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
