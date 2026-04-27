-- ===========================================
-- تشفير كلمات المرور في قاعدة البيانات (إصدار 2)
-- Secure Password Encryption v2
-- متوافق مع جدول profiles
-- ===========================================

-- 1. تفعيل امتداد التشفير
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. دالة لتشفير كلمة المرور
CREATE OR REPLACE FUNCTION public.hash_password(password text)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  -- استخدام bcrypt مع تكلفة 12
  RETURN crypt(password, gen_salt('bf', 12));
END;
$$;

-- 3. دالة للتحقق من كلمة المرور
CREATE OR REPLACE FUNCTION public.verify_password(password text, hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN crypt(password, hash) = hash;
END;
$$;

-- 4. دالة للمصادقة الآمنة
CREATE OR REPLACE FUNCTION public.authenticate_user(
  p_job_number text,
  p_password text
)
RETURNS TABLE(
  id uuid,
  full_name text,
  role text,
  success boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_full_name text;
  v_role text;
  v_password_hash text;
BEGIN
  -- البحث عن المستخدم
  SELECT id, full_name, role, password_hash
  INTO v_id, v_full_name, v_role, v_password_hash
  FROM public.profiles
  WHERE job_number = p_job_number;
  
  -- التحقق من وجود المستخدم وصحة كلمة المرور
  IF v_id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, false;
  ELSIF v_password_hash IS NULL THEN
    -- كلمة المرور غير موجودة
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, false;
  ELSIF verify_password(p_password, v_password_hash) THEN
    -- تحديث آخر تسجيل دخول
    UPDATE public.profiles
    SET last_login = NOW()
    WHERE id = v_id;
    
    RETURN QUERY SELECT v_id, v_full_name, v_role, true;
  ELSE
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, false;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.authenticate_user FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.authenticate_user TO authenticated;

-- 5. دالة لتغيير كلمة المرور
CREATE OR REPLACE FUNCTION public.change_password(
  p_user_id uuid,
  p_old_password text,
  p_new_password text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
BEGIN
  -- المستخدم يمكنه تغيير كلمة مروره فقط أو المشرف
  IF auth.uid() != p_user_id AND NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  -- جلب الهاش الحالي
  SELECT password_hash INTO v_hash
  FROM public.profiles
  WHERE id = p_user_id;
  
  -- التحقق من كلمة المرور القديمة (ليس مطلوباً من المشرف)
  IF auth.uid() = p_user_id THEN
    IF v_hash IS NULL OR NOT verify_password(p_old_password, v_hash) THEN
      RETURN false;
    END IF;
  END IF;
  
  -- تحديث كلمة المرور
  UPDATE public.profiles
  SET password_hash = hash_password(p_new_password),
      updated_at = NOW()
  WHERE id = p_user_id;
  
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.change_password FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.change_password TO authenticated;

-- 6. دالة لإنشاء مستخدم جديد (للمشرفين فقط)
CREATE OR REPLACE FUNCTION public.create_profile(
  p_id uuid,
  p_full_name text,
  p_job_number text,
  p_password text,
  p_role text DEFAULT 'user'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- التحقق من صلاحيات المشرف
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only admins can create users';
  END IF;
  
  -- إدراج المستخدم مع كلمة مرور مشفرة
  INSERT INTO public.profiles (id, full_name, job_number, password_hash, role, updated_at)
  VALUES (
    p_id,
    p_full_name,
    p_job_number,
    hash_password(p_password),
    p_role,
    NOW()
  );
  
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.create_profile FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_profile TO authenticated;