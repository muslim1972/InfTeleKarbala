-- إصلاح دالة تشفير كلمة المرور لتحديد مخطط extensions وتفعيل SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.hash_password(password text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN extensions.crypt(password, extensions.gen_salt('bf', 10));
END;
$$;

GRANT EXECUTE ON FUNCTION public.hash_password(text) TO authenticated, anon, service_role;

-- إصلاح دالة التحقق من كلمة المرور لتحديد مخطط extensions وتفعيل SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.verify_password(password text, hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF hash LIKE '$2a$%' OR hash LIKE '$2b$%' THEN
    RETURN extensions.crypt(password, hash) = hash;
  END IF;
  RETURN password = hash;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_password(text, text) TO authenticated, anon, service_role;

-- التأكد من صلاحيات دالة rpc_sync_user_auth
GRANT EXECUTE ON FUNCTION public.rpc_sync_user_auth(uuid, text, text) TO authenticated, anon, service_role;
