DROP FUNCTION IF EXISTS public.get_available_profiles();
DROP FUNCTION IF EXISTS public.get_available_profiles_by_ids(uuid[]);
DROP FUNCTION IF EXISTS public.get_own_profile();
-- ═══════════════════════════════════════════════════════════════
-- سكربت إصلاح ثغرة تسريب تشفير كلمات المرور (Hash Disclosure)
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- 1. تعديل دالة get_own_profile لمنع تسريب password_hash
CREATE OR REPLACE FUNCTION public.get_own_profile()
RETURNS SETOF public.profiles LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_row public.profiles;
    v_key text;
    v_enc text;
BEGIN
    SELECT value INTO v_key FROM public._internal_keys WHERE name = 'iban_key' LIMIT 1;
    SELECT * INTO v_row FROM public.profiles WHERE id = auth.uid();
    BEGIN
        IF v_row.iban_encrypted IS NOT NULL AND v_row.iban_encrypted != '' THEN
            v_row.iban := pgp_sym_decrypt(decode(v_row.iban_encrypted, 'base64'), v_key);
        ELSE
            SELECT iban_encrypted INTO v_enc FROM public.financial_records WHERE user_id = auth.uid() LIMIT 1;
            IF v_enc IS NOT NULL AND v_enc != '' THEN
                v_row.iban := pgp_sym_decrypt(decode(v_enc, 'base64'), v_key);
            END IF;
        END IF;
    EXCEPTION WHEN OTHERS THEN v_row.iban := NULL; END;

    -- SECURITY FIX: تصفير بيانات كلمة المرور قبل الإرسال
    v_row.password_hash := NULL;
    v_row.password := NULL;

    RETURN NEXT v_row;
END; $$;

-- 2. تعديل دالة get_available_profiles لمنع تسريب password_hash
CREATE OR REPLACE FUNCTION public.get_available_profiles()
RETURNS SETOF public.profiles LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_row public.profiles;
BEGIN
    FOR v_row IN 
        SELECT * FROM public.profiles WHERE status = 'active'
    LOOP
        -- SECURITY FIX: تصفير بيانات كلمة المرور قبل الإرسال
        v_row.password_hash := NULL;
        v_row.password := NULL;
        RETURN NEXT v_row;
    END LOOP;
END;
$$;

-- 3. تعديل دالة get_available_profiles_by_ids لمنع تسريب password_hash
CREATE OR REPLACE FUNCTION public.get_available_profiles_by_ids(profile_ids uuid[])
RETURNS SETOF public.profiles LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_row public.profiles;
BEGIN
    FOR v_row IN 
        SELECT * FROM public.profiles WHERE id = ANY(profile_ids)
    LOOP
        -- SECURITY FIX: تصفير بيانات كلمة المرور قبل الإرسال
        v_row.password_hash := NULL;
        v_row.password := NULL;
        RETURN NEXT v_row;
    END LOOP;
END;
$$;

COMMIT;

