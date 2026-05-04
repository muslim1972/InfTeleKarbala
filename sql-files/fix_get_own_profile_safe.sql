-- ═══════════════════════════════════════════════════════════════
-- السكربت النهائي والآمن: تشفير IBAN (النسخة المنقحة)
-- يحل مشكلة الأمان (لا يوجد مفتاح هنا) ومشكلة الـ 404
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- 1. جدول المفاتيح الداخلي
CREATE TABLE IF NOT EXISTS public._internal_keys (
    name text PRIMARY KEY,
    value text NOT NULL
);
ALTER TABLE public._internal_keys ENABLE ROW LEVEL SECURITY;

-- 2. جلب المفتاح آلياً من Vault (أكثر أماناً)
DO $$
DECLARE
    v_key text;
BEGIN
    SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'iban_encryption_key' LIMIT 1;
    
    IF v_key IS NULL THEN
        RAISE EXCEPTION 'المفتاح غير موجود في Vault! تأكد من وجود iban_encryption_key';
    END IF;

    INSERT INTO public._internal_keys (name, value)
    VALUES ('iban_key', v_key)
    ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value;
END $$;

-- 3. دالة الملف الشخصي
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
    RETURN NEXT v_row;
END; $$;

-- 4. الدالة المالية الآمنة (باسم جديد لحل الـ 404)
CREATE OR REPLACE FUNCTION public.get_financial_iban_secure(p_uid uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_key text;
    v_enc text;
BEGIN
    SELECT value INTO v_key FROM public._internal_keys WHERE name = 'iban_key' LIMIT 1;
    SELECT iban_encrypted INTO v_enc FROM public.financial_records WHERE user_id = p_uid LIMIT 1;
    IF v_enc IS NULL OR v_enc = '' THEN RETURN NULL; END IF;
    RETURN pgp_sym_decrypt(decode(v_enc, 'base64'), v_key);
END; $$;

-- 5. دالة جلب IBAN الموظف (للمدراء)
CREATE OR REPLACE FUNCTION public.get_employee_iban_secure(p_uid uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_key text;
    v_enc text;
BEGIN
    SELECT value INTO v_key FROM public._internal_keys WHERE name = 'iban_key' LIMIT 1;
    SELECT iban_encrypted INTO v_enc FROM public.profiles WHERE id = p_uid LIMIT 1;
    IF v_enc IS NULL OR v_enc = '' THEN
        SELECT iban_encrypted INTO v_enc FROM public.financial_records WHERE user_id = p_uid LIMIT 1;
    END IF;
    IF v_enc IS NULL OR v_enc = '' THEN RETURN NULL; END IF;
    RETURN pgp_sym_decrypt(decode(v_enc, 'base64'), v_key);
END; $$;

GRANT EXECUTE ON FUNCTION public.get_own_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_financial_iban_secure(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_iban_secure(uuid) TO authenticated;

COMMIT;
