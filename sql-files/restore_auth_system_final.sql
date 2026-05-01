
-- =============================================================
-- السكربت الأمني الشامل (الإصدار النهائي والمنقذ)
-- تفعيل التشفير، حماية RPCs، ومنع تسريب البيانات
-- =============================================================

BEGIN;

-- 1. تفعيل ملحق التشفير (ضروري جداً)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. دالة التحقق المساعدة (verify_password)
CREATE OR REPLACE FUNCTION public.verify_password(password text, hash text)
RETURNS boolean AS $$
BEGIN
  -- إذا كان الهاش يبدأ بـ $2a$ أو $2b$ فهو مشفر بـ bcrypt
  IF hash LIKE '$2a$%' OR hash LIKE '$2b$%' THEN
    RETURN crypt(password, hash) = hash;
  END IF;
  -- إذا لم يكن مشفراً (حالة انتقالية)، نقارن النص الصريح
  RETURN password = hash;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- 3. دالة التشفير المساعدة (hash_password)
CREATE OR REPLACE FUNCTION public.hash_password(password text)
RETURNS text AS $$
BEGIN
  RETURN crypt(password, gen_salt('bf', 12));
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- 4. إعادة بناء دالة تسجيل الدخول (get_login_profile) - النسخة المشفرة
DROP FUNCTION IF EXISTS public.get_login_profile(text, text);

CREATE OR REPLACE FUNCTION public.get_login_profile(p_username text, p_password text)
RETURNS TABLE (
    id uuid,
    job_number text,
    email text,
    real_email text,
    role text,
    full_name text
) 
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_user_id uuid;
    v_job_number text;
    v_real_email text;
    v_role text;
    v_full_name text;
    v_auth_email text;
    v_password_hash text;
    v_blocked_until timestamp with time zone;
BEGIN
    -- أ. الحماية من التخمين
    SELECT blocked_until INTO v_blocked_until FROM public.rate_limits 
    WHERE identifier = p_username AND endpoint = 'login';
    
    IF v_blocked_until IS NOT NULL AND v_blocked_until > NOW() THEN
        RAISE EXCEPTION 'Too many attempts. Blocked until %', v_blocked_until;
    END IF;

    -- ب. البحث عن المستخدم (نجلب الهاش من عمود password_hash أو password)
    SELECT p.id, p.job_number, p.email, p.role, p.full_name, COALESCE(p.password_hash, p.password)
    INTO v_user_id, v_job_number, v_real_email, v_role, v_full_name, v_password_hash
    FROM public.profiles p
    WHERE p.username = p_username;

    -- ج. التحقق من كلمة المرور باستخدام التشفير
    IF v_user_id IS NULL OR NOT public.verify_password(p_password, v_password_hash) THEN
        PERFORM public.update_rate_limit(p_username, 'login', false);
        RETURN;
    END IF;

    -- د. جلب الإيميل المولد
    SELECT au.email INTO v_auth_email FROM auth.users au WHERE au.id = v_user_id;

    -- هـ. نجاح الدخول
    PERFORM public.update_rate_limit(p_username, 'login', true);
    RETURN QUERY SELECT v_user_id, v_job_number, v_auth_email, v_real_email, v_role, v_full_name;
END;
$$;

-- 5. تحديث دالة تغيير كلمة المرور لتكون مشفرة (change_password)
CREATE OR REPLACE FUNCTION public.secure_change_password(p_new_password text)
RETURNS boolean AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.profiles
  SET password_hash = public.hash_password(p_new_password),
      password = NULL, -- مسح كلمة المرور النصية للأبد عند أول تغيير
      updated_at = NOW()
  WHERE id = auth.uid();
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. دالة جلب البيانات الشخصية (get_own_profile)
CREATE OR REPLACE FUNCTION public.get_own_profile()
RETURNS SETOF public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RETURN QUERY SELECT * FROM public.profiles WHERE id = auth.uid();
END;
$$;

-- 7. الصلاحيات
GRANT EXECUTE ON FUNCTION public.get_login_profile(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_own_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.secure_change_password(text) TO authenticated;

-- 8. الهجرة الفورية (Migration): تشفير كل كلمات المرور النصية الحالية
UPDATE public.profiles
SET password_hash = public.hash_password(password),
    password = NULL -- حذف النص الصريح فوراً بعد التشفير
WHERE password IS NOT NULL 
  AND (password_hash IS NULL OR password_hash NOT LIKE '$2a$%');

COMMIT;
