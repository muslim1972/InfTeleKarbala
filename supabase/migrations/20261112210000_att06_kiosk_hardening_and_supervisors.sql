-- ==============================================================================
-- B.R.I.C.K Kernel: BE-ATT-06 (Devices, Biometrics, Kiosk)
-- Migration: 20261112210000_att06_kiosk_hardening_and_supervisors.sql
-- Description:
--   1) Add `has_kiosk_access` boolean to public.profiles for Kiosk Supervisor role.
--   2) Ensure public.kiosk_devices has `governorate`, `activated_by_supervisor_id`, `activated_at`.
--   3) Provision/ensure dedicated kiosk service account (kiosk.system@inftelekarbala.iq, role='kiosk').
--   4) Security hardening: Revoke `is_kiosk_user()` from leave_requests INSERT, UPDATE, DELETE policies.
--   5) Enhance `kiosk_get_employees` to filter strictly by kiosk device governorate,
--      returning full hierarchy (dept_text, section_text, unit_text) and primary work location.
--   6) Enhance `kiosk_activate` to record supervisor verification.
--   7) Enhance `admin_create_kiosk_device` to support governorate parameter.
-- ==============================================================================

-- ── 1. إضافة حقل صلاحية مشرف الأكشاك في جدول profiles ──
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS has_kiosk_access boolean NOT NULL DEFAULT false;

-- ── 2. تحديث جدول kiosk_devices لدعم المحافظة والمشرف المفعِّل ──
ALTER TABLE public.kiosk_devices
ADD COLUMN IF NOT EXISTS governorate text NOT NULL DEFAULT 'karbala',
ADD COLUMN IF NOT EXISTS activated_by_supervisor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS activated_at timestamptz;

-- ── 3. تأمين وإنشاء حساب خدمة الكيوسك الموحد في auth.users و profiles ──
DO $$
DECLARE
    v_user_id uuid;
    v_random_pass text;
BEGIN
    SELECT id INTO v_user_id FROM public.profiles WHERE role = 'kiosk' LIMIT 1;
    IF v_user_id IS NULL THEN
        SELECT id INTO v_user_id FROM auth.users WHERE email = 'kiosk.system@inftelekarbala.iq' LIMIT 1;
    END IF;

    IF v_user_id IS NULL THEN
        v_user_id := gen_random_uuid();
        v_random_pass := 'KSK-' || md5(random()::text || clock_timestamp()::text) || '#HonorPadX9';

        INSERT INTO auth.users (
            instance_id, id, aud, role, email,
            encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data,
            created_at, updated_at,
            confirmation_token, recovery_token, email_change, email_change_token_new
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            v_user_id,
            'authenticated', 'authenticated', 'kiosk.system@inftelekarbala.iq',
            crypt(v_random_pass, gen_salt('bf', 10)), now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{}'::jsonb,
            now(), now(),
            '', '', '', ''
        );

        INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
        SELECT gen_random_uuid(), v_user_id, v_user_id::text, 'email',
               jsonb_build_object('sub', v_user_id::text, 'email', 'kiosk.system@inftelekarbala.iq'),
               now(), now(), now()
        WHERE NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = v_user_id AND provider = 'email');
    END IF;

    -- تثبيت ملف التعريف لحساب الكيوسك
    INSERT INTO public.profiles (id, job_number, full_name, role, governorate)
    VALUES (v_user_id, 'KSK-000000', 'كيوسك بصمة الموقع (حساب خدمة)', 'kiosk', 'karbala')
    ON CONFLICT (id) DO UPDATE SET
        role = 'kiosk',
        full_name = 'كيوسك بصمة الموقع (حساب خدمة)';

    -- تصحيح أي أجهزة كيوسك تشير لمعرّف مفقود
    UPDATE public.kiosk_devices
    SET kiosk_user_id = v_user_id
    WHERE kiosk_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = kiosk_devices.kiosk_user_id);
END $$;

-- ── 4. إغلاق الثغرة الأمنية على جدول leave_requests فوراً ──
-- سحب صلاحية is_kiosk_user() من سياسات INSERT / UPDATE / DELETE على leave_requests
DROP POLICY IF EXISTS "Leave requests delete" ON public.leave_requests;
CREATE POLICY "Leave requests delete" ON public.leave_requests
    FOR DELETE TO authenticated
    USING (
        (user_id = auth.uid()) OR
        (get_my_admin_role() = ANY (ARRAY['developer'::text, 'general'::text, 'it_supervisor'::text, 'hr'::text, 'biometric'::text, 'attendance_supervisor'::text]))
    );

DROP POLICY IF EXISTS "Leave requests insert" ON public.leave_requests;
CREATE POLICY "Leave requests insert" ON public.leave_requests
    FOR INSERT TO authenticated
    WITH CHECK (
        (user_id = auth.uid()) OR
        (get_my_admin_role() = ANY (ARRAY['developer'::text, 'general'::text, 'it_supervisor'::text, 'hr'::text, 'biometric'::text, 'attendance_supervisor'::text]))
    );

DROP POLICY IF EXISTS "Leave requests update" ON public.leave_requests;
CREATE POLICY "Leave requests update" ON public.leave_requests
    FOR UPDATE TO authenticated
    USING (
        (user_id = auth.uid()) OR
        (get_my_admin_role() = ANY (ARRAY['developer'::text, 'general'::text, 'it_supervisor'::text, 'hr'::text, 'biometric'::text, 'attendance_supervisor'::text]))
    )
    WITH CHECK (
        (user_id = auth.uid()) OR
        (get_my_admin_role() = ANY (ARRAY['developer'::text, 'general'::text, 'it_supervisor'::text, 'hr'::text, 'biometric'::text, 'attendance_supervisor'::text]))
    );

-- ── 5. تحديث دالة التحقق من جهاز الكيوسك ──
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
        WHERE activation_code = trim(upper(p_code))
          AND is_active = true
          AND kiosk_user_id = auth.uid()
    );
END;
$function$;

-- ── 6. تحديث دالة إنشاء الكيوسك لتقبل المحافظة ──
DROP FUNCTION IF EXISTS public.admin_create_kiosk_device(text, uuid[]);
CREATE OR REPLACE FUNCTION public.admin_create_kiosk_device(
    p_name text,
    p_work_location_ids uuid[] DEFAULT NULL::uuid[],
    p_governorate text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_kiosk_user uuid;
    v_row public.kiosk_devices%ROWTYPE;
    v_loc uuid;
    v_gov text;
    v_caller_role text;
BEGIN
    IF NOT public.is_privileged_user() THEN
        SELECT p.admin_role INTO v_caller_role FROM public.profiles p WHERE p.id = auth.uid();
        IF v_caller_role NOT IN ('developer', 'general', 'biometric') AND NOT EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND has_kiosk_access = true
        ) THEN
            RETURN jsonb_build_object('success', false, 'message', 'غير مصرح لك بإدارة الأكشاك');
        END IF;
    END IF;

    IF p_name IS NULL OR length(trim(p_name)) < 2 THEN
        RETURN jsonb_build_object('success', false, 'message', 'اسم الجهاز مطلوب');
    END IF;

    -- تحديد المحافظة
    v_gov := COALESCE(NULLIF(trim(p_governorate), ''), public.get_my_governorate(), 'karbala');

    SELECT id INTO v_kiosk_user FROM public.profiles WHERE role = 'kiosk' LIMIT 1;
    IF v_kiosk_user IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'حساب خدمة الكيوسك غير موجود');
    END IF;

    INSERT INTO public.kiosk_devices (name, kiosk_user_id, governorate, created_by)
    VALUES (trim(p_name), v_kiosk_user, v_gov, auth.uid())
    RETURNING * INTO v_row;

    IF p_work_location_ids IS NOT NULL THEN
        FOREACH v_loc IN ARRAY p_work_location_ids LOOP
            INSERT INTO public.kiosk_device_locations (device_id, work_location_id)
            VALUES (v_row.id, v_loc)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;

    RETURN jsonb_build_object('success', true, 'device', to_jsonb(v_row));
END;
$function$;

-- ── 7. تحديث دالة سرد الأجهزة مع المحافظة والمشرف ──
CREATE OR REPLACE FUNCTION public.admin_list_kiosk_devices()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF NOT (
        public.is_privileged_user() OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (has_kiosk_access = true OR admin_role IN ('developer', 'general', 'biometric')))
    ) THEN
        RETURN jsonb_build_object('success', false, 'message', 'غير مصرح لك');
    END IF;

    RETURN jsonb_build_object('success', true, 'devices', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'id', k.id,
            'name', k.name,
            'activation_code', k.activation_code,
            'governorate', k.governorate,
            'locations', COALESCE((
                SELECT jsonb_agg(jsonb_build_object('id', w.id, 'name', w.name, 'latitude', w.latitude, 'longitude', w.longitude) ORDER BY w.name)
                FROM public.kiosk_device_locations kl
                JOIN public.work_locations w ON w.id = kl.work_location_id
                WHERE kl.device_id = k.id
            ), '[]'::jsonb),
            'is_active', k.is_active,
            'last_seen_at', k.last_seen_at,
            'activated_at', k.activated_at,
            'activated_by_supervisor_name', (SELECT full_name FROM public.profiles WHERE id = k.activated_by_supervisor_id),
            'created_at', k.created_at
        ) ORDER BY k.created_at DESC)
        FROM public.kiosk_devices k
        WHERE k.governorate = public.get_my_governorate() OR public.get_my_admin_role() IN ('developer', 'general')
    ), '[]'::jsonb));
END;
$function$;

-- ── 8. تحديث دالة تفعيل الكيوسك لتوثيق المشرف ──
DROP FUNCTION IF EXISTS public.kiosk_activate(text);
CREATE OR REPLACE FUNCTION public.kiosk_activate(p_code text, p_supervisor_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_clean_code text := trim(upper(p_code));
    v_row public.kiosk_devices%ROWTYPE;
    v_sup_name text := NULL;
BEGIN
    IF NOT public.kiosk_device_check(v_clean_code) THEN
        RETURN jsonb_build_object('success', false, 'message', 'رمز التفعيل غير صالح أو الجهاز موقوف');
    END IF;

    -- إذا قُدِّم معرّف المشرف، نتحقق من صلاحيته
    IF p_supervisor_id IS NOT NULL THEN
        SELECT full_name INTO v_sup_name
        FROM public.profiles
        WHERE id = p_supervisor_id
          AND (
              role = 'admin'
              OR admin_role IN ('developer', 'general', 'biometric')
              OR has_kiosk_access = true
          );
        IF v_sup_name IS NULL THEN
            RETURN jsonb_build_object('success', false, 'message', 'المشرف غير مخول بتفعيل الكيوسك');
        END IF;
    END IF;

    SELECT * INTO v_row FROM public.kiosk_devices WHERE activation_code = v_clean_code;

    UPDATE public.kiosk_devices
    SET last_seen_at = now(),
        activated_at = COALESCE(activated_at, now()),
        activated_by_supervisor_id = COALESCE(p_supervisor_id, activated_by_supervisor_id)
    WHERE id = v_row.id;

    RETURN jsonb_build_object(
        'success', true,
        'device_id', v_row.id,
        'name', v_row.name,
        'governorate', v_row.governorate,
        'activated_by_supervisor_name', v_sup_name,
        'locations', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', w.id, 'name', w.name, 'latitude', w.latitude, 'longitude', w.longitude
            ) ORDER BY w.name)
            FROM public.kiosk_device_locations kl
            JOIN public.work_locations w ON w.id = kl.work_location_id
            WHERE kl.device_id = v_row.id
        ), '[]'::jsonb)
    );
END;
$function$;

-- ── 9. دالة جلب المشرفين المخولين بتفعيل الأكشاك (بصمات وجوههم) ──
CREATE OR REPLACE FUNCTION public.kiosk_get_authorized_supervisors(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_clean_code text := trim(upper(p_code));
    v_device public.kiosk_devices%ROWTYPE;
BEGIN
    SELECT * INTO v_device FROM public.kiosk_devices WHERE activation_code = v_clean_code AND is_active = true;
    IF v_device.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'رمز التفعيل غير صالح أو الجهاز موقوف');
    END IF;

    RETURN jsonb_build_object('success', true, 'supervisors', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'id', p.id,
            'full_name', p.full_name,
            'role_label', CASE
                WHEN p.admin_role = 'developer' THEN 'مطور النظام'
                WHEN p.admin_role = 'general' THEN 'مشرف عام'
                WHEN p.admin_role = 'biometric' THEN 'مشرف بصمة'
                WHEN p.has_kiosk_access = true THEN 'مشرف أكشاك البصمة'
                ELSE 'مشرف إدارة'
            END,
            'face_descriptor', p.face_descriptor
        ))
        FROM public.profiles p
        WHERE p.face_descriptor IS NOT NULL
          AND (
              p.admin_role IN ('developer', 'general', 'biometric')
              OR p.role = 'admin'
              OR p.has_kiosk_access = true
          )
          AND (p.governorate = v_device.governorate OR p.admin_role IN ('developer', 'general'))
    ), '[]'::jsonb));
END;
$function$;

-- ── 10. دالة جلب موظفي البصمة مفلترة بمحافظة الكيوسك مع كامل المسار الإداري ──
CREATE OR REPLACE FUNCTION public.kiosk_get_employees(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_clean_code text := trim(upper(p_code));
    v_device public.kiosk_devices%ROWTYPE;
BEGIN
    IF NOT public.kiosk_device_check(v_clean_code) THEN
        RETURN jsonb_build_object('success', false, 'message', 'رمز التفعيل غير صالح أو الجهاز موقوف');
    END IF;

    SELECT * INTO v_device FROM public.kiosk_devices WHERE activation_code = v_clean_code;
    IF v_device.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'الجهاز غير موجود');
    END IF;

    -- تحديث آخر ظهور للجهاز
    UPDATE public.kiosk_devices SET last_seen_at = now() WHERE id = v_device.id;

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
                'today_start', wsd.start_time,
                'today_end', wsd.end_time,
                'today_rest', COALESCE(wsd.is_rest_day, true),
                'today_is_evening', COALESCE(wsd.is_evening, false),
                'today_is_night', COALESCE(wsd.is_night, false),
                'face_descriptor', p.face_descriptor,
                'assigned_location_ids', COALESCE((
                    SELECT jsonb_agg(wle.location_id)
                    FROM public.work_location_employees wle
                    WHERE wle.employee_id = p.id
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

-- منح الصلاحيات التنفيذية
GRANT EXECUTE ON FUNCTION public.admin_create_kiosk_device(text, uuid[], text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_kiosk_devices() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kiosk_activate(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kiosk_get_authorized_supervisors(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kiosk_get_employees(text) TO authenticated, service_role;
