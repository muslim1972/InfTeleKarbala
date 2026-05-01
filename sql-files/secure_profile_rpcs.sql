
-- ===========================================
-- دوال الملف الشخصي الآمنة (Profile RPCs)
-- ===========================================

BEGIN;

-- 1. دالة جلب بيانات الملف الشخصي للمستخدم الحالي
-- تضمن جلب كافة البيانات حتى مع وجود RLS صارم
CREATE OR REPLACE FUNCTION public.get_own_profile()
RETURNS SETOF public.profiles
LANGUAGE plpgsql
SECURITY DEFINER -- لاسترجاع البيانات بأمان
SET search_path = public
AS $$
BEGIN
    RETURN QUERY 
    SELECT * FROM public.profiles 
    WHERE id = auth.uid();
END;
$$;

-- 2. منح صلاحية التنفيذ للمستخدمين المسجلين فقط
REVOKE ALL ON FUNCTION public.get_own_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_own_profile() TO authenticated;

COMMIT;
