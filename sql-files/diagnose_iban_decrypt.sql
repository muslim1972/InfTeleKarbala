-- ═══════════════════════════════════════════════════════════════
-- تشخيص متقدم: اختبار فك التشفير عبر RPC (نفس سياق التطبيق)
-- الخطوة 1: نفّذ هذا في SQL Editor
-- الخطوة 2: افتح التطبيق → Console (F12) → نفّذ الأمر المذكور أدناه
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.test_iban_decrypt()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_enc text;
  v_result text;
BEGIN
  -- الخطوة 1: جلب المفتاح
  BEGIN
    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets WHERE name = 'iban_encryption_key' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    RETURN 'FAIL_STEP1_KEY: ' || SQLERRM;
  END;

  IF v_key IS NULL THEN
    RETURN 'FAIL_STEP1: KEY_IS_NULL';
  END IF;

  -- الخطوة 2: جلب البيانات المشفرة
  SELECT iban_encrypted INTO v_enc FROM public.profiles WHERE id = auth.uid();
  
  IF v_enc IS NULL OR v_enc = '' THEN
    SELECT iban_encrypted INTO v_enc 
    FROM public.financial_records WHERE user_id = auth.uid();
  END IF;

  IF v_enc IS NULL OR v_enc = '' THEN
    RETURN 'FAIL_STEP2: NO_ENCRYPTED_DATA_FOR_USER';
  END IF;

  -- الخطوة 3: فك التشفير
  BEGIN
    v_result := pgp_sym_decrypt(decode(v_enc, 'base64'), v_key);
  EXCEPTION WHEN OTHERS THEN
    RETURN 'FAIL_STEP3_DECRYPT: ' || SQLERRM;
  END;

  RETURN 'SUCCESS: ' || v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.test_iban_decrypt() TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- بعد تنفيذ ما أعلاه، سجّل دخول بالتطبيق
-- ثم افتح Console (F12) والصق هذا الأمر:
--
--   const { data, error } = await window.__supabase.rpc('test_iban_decrypt');
--   console.log('Result:', data, 'Error:', error);
--
-- أو ببساطة نفّذ هذا في SQL Editor مع تحديد user_id:
-- SELECT public.test_iban_decrypt();
-- ═══════════════════════════════════════════════════════════════
