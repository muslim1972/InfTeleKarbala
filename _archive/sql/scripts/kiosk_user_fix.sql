-- إنشاء حساب خدمة الكيوسك (تصحيح: بلا ON CONFLICT — الحماية بالفحص المسبق)
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
        RETURNING id INTO v_user_id;

        INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
        VALUES (
            gen_random_uuid(), v_user_id, 'email', 'email',
            jsonb_build_object('sub', v_user_id::text, 'email', 'kiosk.system@inftelekarbala.iq'),
            now(), now(), now()
        );
    END IF;

    INSERT INTO public.profiles (id, full_name, role, job_number, governorate)
    VALUES (v_user_id, 'كيوسك بصمة (حساب خدمة)', 'kiosk', 'KIOSK-SVC', 'karbala')
    ON CONFLICT (id) DO UPDATE SET role = 'kiosk'
    WHERE public.profiles.role IS DISTINCT FROM 'kiosk';

    UPDATE public.kiosk_devices SET kiosk_user_id = v_user_id WHERE kiosk_user_id IS NULL;
END $$;

\echo '=== التحقق ==='
SELECT id, email FROM auth.users WHERE email = 'kiosk.system@inftelekarbala.iq';
SELECT id, full_name, role FROM public.profiles WHERE role = 'kiosk';
