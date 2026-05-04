-- ═══════════════════════════════════════════════════════════════
-- إصلاح نهائي: get_own_profile مع فك تشفير IBAN مباشر
-- بدون استدعاء دوال وسيطة (لتجنب مشاكل صلاحيات PostgREST)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_own_profile()
RETURNS SETOF public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result public.profiles;
  v_key text;
  v_fin_iban_enc text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_result FROM public.profiles WHERE id = auth.uid();

  -- فك تشفير IBAN مباشرة (بدون دوال وسيطة)
  BEGIN
    -- جلب المفتاح مباشرة من Vault
    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
    WHERE name = 'iban_encryption_key' LIMIT 1;

    IF v_key IS NOT NULL THEN
      -- محاولة من profiles أولاً
      IF v_result.iban_encrypted IS NOT NULL AND v_result.iban_encrypted != '' THEN
        v_result.iban := pgp_sym_decrypt(decode(v_result.iban_encrypted, 'base64'), v_key);
      ELSE
        -- احتياطي: من financial_records
        SELECT iban_encrypted INTO v_fin_iban_enc
        FROM public.financial_records WHERE user_id = auth.uid();

        IF v_fin_iban_enc IS NOT NULL AND v_fin_iban_enc != '' THEN
          v_result.iban := pgp_sym_decrypt(decode(v_fin_iban_enc, 'base64'), v_key);
        END IF;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_result.iban := NULL;
  END;

  RETURN NEXT v_result;
END;
$$;

-- نفس المنهج لـ get_employee_iban
CREATE OR REPLACE FUNCTION public.get_employee_iban(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encrypted text;
  v_caller_role text;
  v_key text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF auth.uid() != p_user_id THEN
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    IF v_caller_role != 'admin' THEN
      RAISE EXCEPTION 'Unauthorized: Admin access required';
    END IF;
  END IF;

  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'iban_encryption_key' LIMIT 1;

  IF v_key IS NULL THEN RETURN NULL; END IF;

  -- محاولة من profiles أولاً
  SELECT iban_encrypted INTO v_encrypted
  FROM public.profiles WHERE id = p_user_id;

  IF v_encrypted IS NULL OR v_encrypted = '' THEN
    SELECT iban_encrypted INTO v_encrypted
    FROM public.financial_records WHERE user_id = p_user_id;
  END IF;

  IF v_encrypted IS NULL OR v_encrypted = '' THEN RETURN NULL; END IF;

  RETURN pgp_sym_decrypt(decode(v_encrypted, 'base64'), v_key);
END;
$$;

-- نفس المنهج لـ get_financial_iban
CREATE OR REPLACE FUNCTION public.get_financial_iban(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encrypted text;
  v_caller_role text;
  v_key text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF auth.uid() != p_user_id THEN
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    IF v_caller_role != 'admin' THEN
      RAISE EXCEPTION 'Unauthorized: Admin access required';
    END IF;
  END IF;

  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'iban_encryption_key' LIMIT 1;

  IF v_key IS NULL THEN RETURN NULL; END IF;

  SELECT iban_encrypted INTO v_encrypted
  FROM public.financial_records WHERE user_id = p_user_id;

  IF v_encrypted IS NULL OR v_encrypted = '' THEN RETURN NULL; END IF;

  RETURN pgp_sym_decrypt(decode(v_encrypted, 'base64'), v_key);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_own_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_iban(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_financial_iban(uuid) TO authenticated;
