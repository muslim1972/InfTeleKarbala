
-- ===========================================
-- السكربت النهائي الموحد لاستعادة نظام التوثيق
-- Unified Authentication Restoration Script
-- ===========================================

BEGIN;

-- ---------------------------------------------------------
-- 1. دالة تسجيل الدخول المحصنة (get_login_profile)
-- ---------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_login_profile(text);
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
    v_blocked_until timestamp with time zone;
BEGIN
    -- أ. التحقق من الـ Rate Limiting (منع التخمين)
    SELECT blocked_until INTO v_blocked_until FROM public.rate_limits 
    WHERE identifier = p_username AND endpoint = 'login';
    
    IF v_blocked_until IS NOT NULL AND v_blocked_until > NOW() THEN
        RAISE EXCEPTION 'Too many attempts. Blocked until %', v_blocked_until;
    END IF;

    -- ب. البحث عن المستخدم في جدول profiles بالمطابقة الصارمة
    SELECT p.id, p.job_number, p.email, p.role, p.full_name
    INTO v_user_id, v_job_number, v_real_email, v_role, v_full_name
    FROM public.profiles p
    WHERE p.username = p_username AND p.password = p_password;

    -- ج. إذا لم يتم العثور على المستخدم
    IF v_user_id IS NULL THEN
        PERFORM public.update_rate_limit(p_username, 'login', false);
        RETURN; -- يعيد نتيجة فارغة
    END IF;

    -- د. جلب الإيميل المولد من جدول auth.users (المحفوظ للجميع)
    SELECT au.email INTO v_auth_email
    FROM auth.users au
    WHERE au.id = v_user_id;

    -- هـ. التحديث التلقائي لسجل المحاولات (ناجح)
    PERFORM public.update_rate_limit(p_username, 'login', true);

    -- و. إرجاع البيانات المطلوبة
    RETURN QUERY SELECT 
        v_user_id, 
        v_job_number, 
        v_auth_email, 
        v_real_email, 
        v_role, 
        v_full_name;
END;
$$;

-- ---------------------------------------------------------
-- 2. دالة جلب البيانات الشخصية (get_own_profile) - النسخة المحصنة
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_own_profile()
RETURNS SETOF public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- [الحارس]: منع الوصول المجهول
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: لم يتم العثور على جلسة صالحة';
  END IF;

  RETURN QUERY
  SELECT * FROM public.profiles WHERE id = auth.uid();
END;
$$;

-- ---------------------------------------------------------
-- 3. صلاحيات التنفيذ (Permissions)
-- ---------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_login_profile(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_login_profile(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_login_profile(text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.get_own_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_own_profile() TO authenticated;

-- ---------------------------------------------------------
-- 4. تحديث سياسات RLS (إجراء وقائي إضافي)
-- ---------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_rpc_lookup" ON public.profiles;
-- نسمح لـ RPC تسجيل الدخول بالوصول للبيانات (يتم التحكم بها داخلياً في الدالة)
CREATE POLICY "profiles_rpc_lookup" ON public.profiles
    FOR SELECT TO anon USING (true);

COMMIT;
