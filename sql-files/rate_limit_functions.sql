-- ===========================================
-- دوال Rate Limiting (الحماية من التخمين)
-- ===========================================

-- 1. دالة للتحقق مما إذا كان المستخدم محظوراً
CREATE OR REPLACE FUNCTION public.check_rate_limit(p_identifier text, p_endpoint text)
RETURNS timestamp with time zone
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_blocked_until timestamp with time zone;
BEGIN
  SELECT blocked_until INTO v_blocked_until FROM public.rate_limits 
  WHERE identifier = p_identifier AND endpoint = p_endpoint;
  RETURN v_blocked_until;
END;
$$;

-- 2. دالة لتحديث حالة الحظر بعد كل محاولة تسجيل دخول
CREATE OR REPLACE FUNCTION public.update_rate_limit(p_identifier text, p_endpoint text, p_success boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
  v_attempts int;
BEGIN
  IF p_success THEN
    -- إذا نجح الدخول، نمسح السجل الخاص بهذا المستخدم
    DELETE FROM public.rate_limits WHERE identifier = p_identifier AND endpoint = p_endpoint;
  ELSE
    -- إذا فشل الدخول
    SELECT id, attempts INTO v_id, v_attempts FROM public.rate_limits WHERE identifier = p_identifier AND endpoint = p_endpoint;
    
    IF v_id IS NOT NULL THEN
      IF v_attempts >= 4 THEN
        -- بعد 5 محاولات خاطئة (المحاولة الحالية هي الخامسة)، نحظره لمدة 30 دقيقة
        UPDATE public.rate_limits SET attempts = attempts + 1, last_attempt = NOW(), blocked_until = NOW() + interval '30 minutes' WHERE id = v_id;
      ELSE
        -- زيادة عدد المحاولات
        UPDATE public.rate_limits SET attempts = attempts + 1, last_attempt = NOW() WHERE id = v_id;
      END IF;
    ELSE
      -- أول محاولة خاطئة
      INSERT INTO public.rate_limits (identifier, endpoint, attempts) VALUES (p_identifier, p_endpoint, 1);
    END IF;
  END IF;
END;
$$;
