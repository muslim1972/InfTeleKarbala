-- =============================================================
-- سكربت تشفير عمود IBAN في جدولي profiles و financial_records
-- باستخدام pgcrypto (PGP/AES-256) + Supabase Vault
-- لجنة الأمن السيبراني - 2026
--
-- ⚠️ ملاحظة: المفتاح يُولَّد تلقائياً عند التنفيذ
--    لا تحتاج إدخال أي مفتاح يدوياً
-- =============================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════
-- 1. تفعيل الملحقات المطلوبة
-- ═══════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ═══════════════════════════════════════════════════════════════
-- 2. إنشاء مفتاح التشفير في Supabase Vault (يُولَّد تلقائياً)
-- ═══════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.secrets WHERE name = 'iban_encryption_key'
  ) THEN
    PERFORM vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'iban_encryption_key',
      'مفتاح تشفير عمود IBAN - لا تحذفه أبداً!'
    );
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 3. إضافة أعمدة التشفير الجديدة في كلا الجدولين
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS iban_encrypted text;
ALTER TABLE public.financial_records ADD COLUMN IF NOT EXISTS iban_encrypted text;

-- ═══════════════════════════════════════════════════════════════
-- 4. دوال التشفير وفك التشفير (مشتركة بين الجدولين)
-- ═══════════════════════════════════════════════════════════════

-- دالة داخلية: جلب المفتاح من Vault
CREATE OR REPLACE FUNCTION internal_get_iban_key()
RETURNS text AS $$
  SELECT decrypted_secret 
  FROM vault.decrypted_secrets 
  WHERE name = 'iban_encryption_key' 
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- دالة التشفير
CREATE OR REPLACE FUNCTION encrypt_iban_value(plaintext text)
RETURNS text AS $$
DECLARE
  v_key text;
BEGIN
  IF plaintext IS NULL OR trim(plaintext) = '' THEN
    RETURN NULL;
  END IF;
  v_key := internal_get_iban_key();
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'IBAN encryption key not found in Vault';
  END IF;
  RETURN encode(pgp_sym_encrypt(plaintext, v_key), 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- دالة فك التشفير
CREATE OR REPLACE FUNCTION decrypt_iban_value(encrypted_text text)
RETURNS text AS $$
DECLARE
  v_key text;
BEGIN
  IF encrypted_text IS NULL OR trim(encrypted_text) = '' THEN
    RETURN NULL;
  END IF;
  v_key := internal_get_iban_key();
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'IBAN decryption key not found in Vault';
  END IF;
  RETURN pgp_sym_decrypt(decode(encrypted_text, 'base64'), v_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════
-- 5. Trigger مشترك: يعمل على كلا الجدولين
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION trigger_encrypt_iban()
RETURNS trigger AS $$
BEGIN
  IF NEW.iban IS NOT NULL AND trim(NEW.iban) != '' THEN
    NEW.iban_encrypted := encrypt_iban_value(NEW.iban);
    NEW.iban := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger على profiles
DROP TRIGGER IF EXISTS trg_encrypt_iban ON public.profiles;
CREATE TRIGGER trg_encrypt_iban
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_encrypt_iban();

-- Trigger على financial_records
DROP TRIGGER IF EXISTS trg_encrypt_iban ON public.financial_records;
CREATE TRIGGER trg_encrypt_iban
  BEFORE INSERT OR UPDATE ON public.financial_records
  FOR EACH ROW
  EXECUTE FUNCTION trigger_encrypt_iban();

-- ═══════════════════════════════════════════════════════════════
-- 6. هجرة البيانات الحالية (تشفير جميع قيم IBAN الموجودة)
-- ═══════════════════════════════════════════════════════════════

-- ── profiles ──
ALTER TABLE public.profiles DISABLE TRIGGER trg_encrypt_iban;

UPDATE public.profiles
SET 
  iban_encrypted = encrypt_iban_value(iban),
  iban = NULL
WHERE iban IS NOT NULL 
  AND trim(iban) != ''
  AND (iban_encrypted IS NULL OR iban_encrypted = '');

ALTER TABLE public.profiles ENABLE TRIGGER trg_encrypt_iban;

-- ── financial_records ──
ALTER TABLE public.financial_records DISABLE TRIGGER trg_encrypt_iban;

UPDATE public.financial_records
SET 
  iban_encrypted = encrypt_iban_value(iban),
  iban = NULL
WHERE iban IS NOT NULL 
  AND trim(iban) != ''
  AND (iban_encrypted IS NULL OR iban_encrypted = '');

ALTER TABLE public.financial_records ENABLE TRIGGER trg_encrypt_iban;

-- ═══════════════════════════════════════════════════════════════
-- 7. RPCs لفك التشفير
-- ═══════════════════════════════════════════════════════════════

-- فك تشفير IBAN من profiles (للمسؤولين والمستخدم نفسه)
CREATE OR REPLACE FUNCTION public.get_employee_iban(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encrypted text;
  v_caller_role text;
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

  -- محاولة جلب IBAN من profiles أولاً ثم من financial_records
  SELECT iban_encrypted INTO v_encrypted 
  FROM public.profiles WHERE id = p_user_id;

  IF v_encrypted IS NULL OR v_encrypted = '' THEN
    SELECT iban_encrypted INTO v_encrypted
    FROM public.financial_records WHERE user_id = p_user_id;
  END IF;

  RETURN decrypt_iban_value(v_encrypted);
END;
$$;

-- فك تشفير IBAN من financial_records فقط
CREATE OR REPLACE FUNCTION public.get_financial_iban(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encrypted text;
  v_caller_role text;
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

  SELECT iban_encrypted INTO v_encrypted
  FROM public.financial_records WHERE user_id = p_user_id;

  RETURN decrypt_iban_value(v_encrypted);
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 8. تحديث get_own_profile لإرجاع IBAN المفكوك تلقائياً
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_own_profile()
RETURNS SETOF public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result public.profiles;
  v_fin_iban text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_result FROM public.profiles WHERE id = auth.uid();

  -- فك تشفير IBAN من profiles
  IF v_result.iban_encrypted IS NOT NULL AND v_result.iban_encrypted != '' THEN
    v_result.iban := decrypt_iban_value(v_result.iban_encrypted);
  ELSE
    -- احتياطي: جلب IBAN المشفر من financial_records
    SELECT iban_encrypted INTO v_fin_iban
    FROM public.financial_records WHERE user_id = auth.uid();
    
    IF v_fin_iban IS NOT NULL AND v_fin_iban != '' THEN
      v_result.iban := decrypt_iban_value(v_fin_iban);
    END IF;
  END IF;

  RETURN NEXT v_result;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 9. الصلاحيات
-- ═══════════════════════════════════════════════════════════════
REVOKE EXECUTE ON FUNCTION internal_get_iban_key() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION encrypt_iban_value(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION decrypt_iban_value(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_employee_iban(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_financial_iban(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_own_profile() TO authenticated;

COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- ✅ ملخص ما تم تنفيذه:
-- 1. مفتاح تشفير آمن AES-256 يُولَّد تلقائياً في Supabase Vault
-- 2. عمود iban_encrypted في كلا الجدولين (profiles + financial_records)
-- 3. Trigger تلقائي على كلا الجدولين: أي كتابة لـ iban → تُشفَّر ويُمسح النص
-- 4. هجرة كاملة: جميع قيم IBAN الحالية في كلا الجدولين تم تشفيرها
-- 5. get_own_profile() → يُرجع IBAN مفكوكاً (من profiles أو financial_records)
-- 6. get_employee_iban(uuid) → IBAN مفكوك من profiles أو financial_records
-- 7. get_financial_iban(uuid) → IBAN مفكوك من financial_records فقط
-- ═══════════════════════════════════════════════════════════════
