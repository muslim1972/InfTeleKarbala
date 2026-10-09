-- ============================================================
-- تعدد الأقسام/الوحدات المرتبطة بالكيوسك
-- كان الجهاز مرتبطاً بموقع عمل واحد (عمود واحد) — والمواقع الواقعية
-- تضم أكثر من قسم وشعبة. صار الربط تعدد-لتعدد عبر kiosk_device_locations.
-- ============================================================

-- 1) جدول الربط
CREATE TABLE IF NOT EXISTS public.kiosk_device_locations (
    device_id uuid NOT NULL REFERENCES public.kiosk_devices(id) ON DELETE CASCADE,
    work_location_id uuid NOT NULL REFERENCES public.work_locations(id) ON DELETE CASCADE,
    PRIMARY KEY (device_id, work_location_id)
);
ALTER TABLE public.kiosk_device_locations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kiosk_device_locations FROM anon, authenticated;

-- 2) ترحيل الارتباط الواحد القديم إلى جدول الربط
INSERT INTO public.kiosk_device_locations (device_id, work_location_id)
SELECT id, work_location_id
FROM public.kiosk_devices
WHERE work_location_id IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE public.kiosk_devices DROP COLUMN IF EXISTS work_location_id;

-- 3) إنشاء جهاز: يقبل مصفوفة مواقع/أقسام
DROP FUNCTION IF EXISTS public.admin_create_kiosk_device(text, uuid);
CREATE OR REPLACE FUNCTION public.admin_create_kiosk_device(p_name text, p_work_location_ids uuid[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_kiosk_user uuid;
    v_row public.kiosk_devices%ROWTYPE;
    v_loc uuid;
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

    INSERT INTO public.kiosk_devices (name, kiosk_user_id, created_by)
    VALUES (trim(p_name), v_kiosk_user, auth.uid())
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

-- 4) السرد: يجمع الأسماء المرتبطة بكل جهاز
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
            'locations', COALESCE((
                SELECT jsonb_agg(jsonb_build_object('id', w.id, 'name', w.name) ORDER BY w.name)
                FROM public.kiosk_device_locations kl
                JOIN public.work_locations w ON w.id = kl.work_location_id
                WHERE kl.device_id = k.id
            ), '[]'::jsonb),
            'is_active', k.is_active, 'last_seen_at', k.last_seen_at, 'created_at', k.created_at
        ) ORDER BY k.created_at DESC)
        FROM public.kiosk_devices k
    ), '[]'::jsonb));
END;
$function$;

-- 5) التفعيل: يعيد مصفوفة المواقع/الأقسام المرتبطة بالجهاز
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

\echo '=== التحقق: جداول ودوال ==='
SELECT to_regclass('public.kiosk_device_locations') AS junction_table;
SELECT column_name FROM information_schema.columns WHERE table_name='kiosk_devices' AND column_name LIKE 'work_location%';
