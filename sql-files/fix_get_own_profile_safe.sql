-- ═══════════════════════════════════════════════════════════════
-- إصلاح عاجل: get_own_profile مع حماية ضد فشل فك التشفير
-- نفّذ هذا فوراً في Supabase SQL Editor
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

  -- محاولة فك تشفير IBAN (آمنة ضد الفشل)
  BEGIN
    IF v_result.iban_encrypted IS NOT NULL AND v_result.iban_encrypted != '' THEN
      v_result.iban := decrypt_iban_value(v_result.iban_encrypted);
    ELSE
      SELECT iban_encrypted INTO v_fin_iban
      FROM public.financial_records WHERE user_id = auth.uid();
      
      IF v_fin_iban IS NOT NULL AND v_fin_iban != '' THEN
        v_result.iban := decrypt_iban_value(v_fin_iban);
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- إذا فشل فك التشفير، لا تعطّل تسجيل الدخول
    v_result.iban := NULL;
  END;

  RETURN NEXT v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_own_profile() TO authenticated;
