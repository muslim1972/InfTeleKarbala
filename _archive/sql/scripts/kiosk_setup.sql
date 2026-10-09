-- ============================================================
-- بنية الكيوسك — نسخة البصمة العامة للأجهزة اللوحية (Tablet)
-- تُنفَّذ على VPS داخل حاوية supabase-db
-- المكونات:
--   1) جدول kiosk_devices (جهاز = رمز تفعيل مرتبط بموقع عمل مسجل)
--   2) حساب خدمة واحد role='kiosk' (كلمة سره يحددها الأدمن من اللوحة)
--   3) RPCs إدارية: إنشاء/سرد/تفعيل/تجديد رمز/تعيين كلمة سر الحساب
--   4) RPCs كيوسك: تفعيل الجهاز + جلب موظفي البصمة (بدون تسجيل دخول موظف)
--   5) سياسات RLS قراءة لدور الكيوسك (attendance_records/leave_requests/profiles)
--   6) submit_attendance_record_secure: دعم الكيوسك مع إبقاء فرض توقيت السيرفر
-- ملاحظة أمنية: الوصول للكيوسك مشروط بـ(جلسة حساب الخدمة + رمز تفعيل نشط)
-- ============================================================

-- ── 1) جدول الأجهزة ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kiosk_devices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    activation_code text NOT NULL UNIQUE
        DEFAULT ('KSK-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10))),
    work_location_id uuid REFERENCES public.work_locations(id) ON DELETE SET NULL,
    kiosk_user_id uuid,
    is_active boolean NOT NULL DEFAULT true,
    last_seen_at timestamptz,
    created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.kiosk_devices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kiosk_devices FROM anon, authenticated;

-- ── 2) دالة تمييز جلسة الكيوسك ──────────────────────────────
CREATE OR REPLACE FUNCTION public.is_kiosk_user()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'kiosk'
    );
END;
$function$;

-- حارس مشترك: رمز تفعيل نشط مرتبط بجلسة الكيوسك الحالية
CREATE OR REPLACE FUNCTION public.kiosk_device_check(p_code text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF auth.uid() IS NULL THEN RETURN false; END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.kiosk_devices
        WHERE activation_code = p_code
          AND is_active = true
          AND kiosk_user_id = auth.uid()
    );
END;
$function$;

-- ── 3) RPCs الإدارية (تتطلب صلاحية مميزة) ───────────────────
CREATE OR REPLACE FUNCTION public.admin_create_kiosk_device(p_name text, p_work_location_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_kiosk_user uuid;
    v_row public.kiosk_devices%ROWTYPE;
BEGIN
    IF NOT public.is_privileged_user() THEN
        RETURN jsonb_build_object('success', false, 'message', 'غير مصرح لك');
    END IF;
    IF p_name IS NULL OR length(trim(p_name)) < 2 THEN
        RETURN jsonb_build_object('success', false, 'message', 'اسم الجهاز مطلوب');
    END IF;

    SELECT id INTO v_kiosk_user FROM public.profiles WHERE role = 'kiosk' LIMIT 1;
    IF v_kiosk_user IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'حساب خدمة الكيوسك غير موجود — راجع المطوّر');
    END IF;

    INSERT INTO public.kiosk_devices (name, work_location_id, kiosk_user_id, created_by)
    VALUES (trim(p_name), p_work_location_id, v_kiosk_user, auth.uid())
    RETURNING * INTO v_row;

    RETURN jsonb_build_object('success', true, 'device', to_jsonb(v_row));
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_list_kiosk_devices()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF NOT public.is_privileged_user() THEN
        RETURN jsonb_build_object('success', false, 'message', 'غير مصرح لك');
    END IF;
    RETURN jsonb_build_object('success', true, 'devices', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'id', k.id, 'name', k.name, 'activation_code', k.activation_code,
            'work_location_id', k.work_location_id, 'work_location_name', w.name,
            'is_active', k.is_active, 'last_seen_at', k.last_seen_at, 'created_at', k.created_at
        ) ORDER BY k.created_at DESC)
        FROM public.kiosk_devices k
        LEFT JOIN public.work_locations w ON w.id = k.work_location_id
    ), '[]'::jsonb));
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_kiosk_active(p_device_id uuid, p_active boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF NOT public.is_privileged_user() THEN
        RETURN jsonb_build_object('success', false, 'message', 'غير مصرح لك');
    END IF;
    UPDATE public.kiosk_devices SET is_active = COALESCE(p_active, NOT is_active)
    WHERE id = p_device_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'الجهاز غير موجود');
    END IF;
    RETURN jsonb_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_regenerate_kiosk_code(p_device_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_new_code text;
BEGIN
    IF NOT public.is_privileged_user() THEN
        RETURN jsonb_build_object('success', false, 'message', 'غير مصرح لك');
    END IF;
    v_new_code := 'KSK-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10));
    UPDATE public.kiosk_devices SET activation_code = v_new_code WHERE id = p_device_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'الجهاز غير موجود');
    END IF;
    RETURN jsonb_build_object('success', true, 'activation_code', v_new_code);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_kiosk_password(p_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_kiosk_user uuid;
BEGIN
    IF NOT public.is_privileged_user() THEN
        RETURN jsonb_build_object('success', false, 'message', 'غير مصرح لك');
    END IF;
    IF p_password IS NULL OR length(p_password) < 8 THEN
        RETURN jsonb_build_object('success', false, 'message', 'كلمة السر يجب أن تكون 8 أحرف على الأقل');
    END IF;
    SELECT id INTO v_kiosk_user FROM public.profiles WHERE role = 'kiosk' LIMIT 1;
    IF v_kiosk_user IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'حساب خدمة الكيوسك غير موجود');
    END IF;

    UPDATE auth.users
    SET encrypted_password = crypt(p_password, gen_salt('bf', 10))
    WHERE id = v_kiosk_user;
    -- إبطال الجلسات القائمة لإجبار الأجهزة على إعادة التفعيل بالكلمة الجديدة
    DELETE FROM auth.sessions WHERE user_id = v_kiosk_user;

    RETURN jsonb_build_object('success', true, 'message', 'تم تعيين كلمة سر الكيوسك');
END;
$function$;

-- ── 4) RPCs الكيوسك (جلسة حساب الخدمة + رمز تفعيل) ──────────
CREATE OR REPLACE FUNCTION public.kiosk_activate(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_row public.kiosk_devices%ROWTYPE;
BEGIN
    IF NOT public.kiosk_device_check(p_code) THEN
        RETURN jsonb_build_object('success', false, 'message', 'رمز التفعيل غير صالح أو الجهاز موقوف');
    END IF;

    SELECT * INTO v_row FROM public.kiosk_devices WHERE activation_code = p_code;
    UPDATE public.kiosk_devices SET last_seen_at = now() WHERE id = v_row.id;

    RETURN jsonb_build_object(
        'success', true,
        'device_id', v_row.id,
        'name', v_row.name,
        'work_location_id', v_row.work_location_id,
        'work_location_name', (SELECT name FROM public.work_locations WHERE id = v_row.work_location_id),
        'latitude', (SELECT latitude FROM public.work_locations WHERE id = v_row.work_location_id),
        'longitude', (SELECT longitude FROM public.work_locations WHERE id = v_row.work_location_id)
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.kiosk_get_employees(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF NOT public.kiosk_device_check(p_code) THEN
        RETURN jsonb_build_object('success', false, 'message', 'رمز التفعيل غير صالح أو الجهاز موقوف');
    END IF;

    RETURN jsonb_build_object('success', true, 'employees', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'id', p.id,
            'full_name', p.full_name,
            'job_number', p.job_number,
            'department_name', d.name,
            'schedule_name', ws.name,
            'today_start', wsd.start_time,
            'today_end', wsd.end_time,
            'today_rest', COALESCE(wsd.is_rest_day, true),
            'today_is_evening', COALESCE(wsd.is_evening, false),
            'today_is_night', COALESCE(wsd.is_night, false),
            'face_descriptor', p.face_descriptor
        ))
        FROM public.profiles p
        LEFT JOIN public.departments d ON d.id = p.department_id
        LEFT JOIN public.work_schedules ws ON ws.id = p.work_schedule_id
        LEFT JOIN public.work_schedule_days wsd
               ON wsd.schedule_id = p.work_schedule_id
              AND wsd.day_of_week = (EXTRACT(DOW FROM (clock_timestamp() AT TIME ZONE 'Asia/Baghdad'))::int)
        WHERE p.face_descriptor IS NOT NULL
          AND COALESCE(p.role, 'employee') NOT IN ('visitor', 'kiosk')
    ), '[]'::jsonb));
END;
$function$;

-- ── 5) سياسات القراءة لدور الكيوسك ──────────────────────────
DROP POLICY IF EXISTS kiosk_read_attendance ON public.attendance_records;
CREATE POLICY kiosk_read_attendance ON public.attendance_records
    FOR SELECT TO authenticated
    USING (public.is_kiosk_user());

DROP POLICY IF EXISTS kiosk_read_leave_requests ON public.leave_requests;
CREATE POLICY kiosk_read_leave_requests ON public.leave_requests
    FOR SELECT TO authenticated
    USING (public.is_kiosk_user());

DROP POLICY IF EXISTS kiosk_read_profiles ON public.profiles;
CREATE POLICY kiosk_read_profiles ON public.profiles
    FOR SELECT TO authenticated
    USING (public.is_kiosk_user());

-- ── 6) حساب خدمة الكيوسك (مرة واحدة — كلمة سر عشوائية معطّلة
--      حتى يحددها الأدمن من اللوحة عبر admin_set_kiosk_password) ──
DO $$
DECLARE
    v_user_id uuid;
    v_random_pass text;
BEGIN
    SELECT id INTO v_user_id FROM public.profiles WHERE role = 'kiosk' LIMIT 1;
    IF v_user_id IS NULL THEN
        SELECT id INTO v_user_id FROM auth.users WHERE email = 'kiosk.system@inftelekarbala.iq';
    END IF;

    IF v_user_id IS NULL THEN
        v_random_pass := 'KSK-' || md5(random()::text || clock_timestamp()::text) || '#x9';
        INSERT INTO auth.users (
            instance_id, id, aud, role, email,
            encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data,
            created_at, updated_at,
            confirmation_token, recovery_token, email_change, email_change_token_new
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            gen_random_uuid(),
            'authenticated', 'authenticated', 'kiosk.system@inftelekarbala.iq',
            crypt(v_random_pass, gen_salt('bf', 10)), now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{}'::jsonb,
            now(), now(),
            '', '', '', ''
        )
        ON CONFLICT (email) DO NOTHING
        RETURNING id INTO v_user_id;

        INSERT INTO auth.identities (id, user_id, provider_id, provider_name, identity_data, last_sign_in_at, created_at, updated_at)
        SELECT gen_random_uuid(), v_user_id, 'email', 'email',
               jsonb_build_object('sub', v_user_id::text, 'email', 'kiosk.system@inftelekarbala.iq'),
               now(), now(), now()
        WHERE NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = v_user_id AND provider_id = 'email');
    END IF;

    INSERT INTO public.profiles (id, full_name, role)
    VALUES (v_user_id, 'كيوسك بصمة (حساب خدمة)', 'kiosk')
    ON CONFLICT (id) DO UPDATE SET role = 'kiosk'
    WHERE public.profiles.role IS DISTINCT FROM 'kiosk';

    UPDATE public.kiosk_devices SET kiosk_user_id = v_user_id WHERE kiosk_user_id IS NULL;
END $$;

-- ── 7) submit_attendance_record_secure: دعم الكيوسك ─────────
-- التغييرات عن النسخة الحية:
--   أ) v_is_kiosk: جلسة دور kiosk تُصرّح بالتسجيل لأي موظف (البصمة المطابقة بالوجه)
--   ب) الكيوسك يبقى خاضعاً لفرض توقيت السيرفر حصراً (لا يثق بساعة التابليت)
--   ج) فحص ملكية السجل لا يسري على الكيوسك، وفحص «سجل اليوم» يسري
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
