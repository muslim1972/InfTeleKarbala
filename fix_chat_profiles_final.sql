-- ==========================================
-- الإصلاح النهائي لمشكلة الأنواع (Type Mismatch)
-- ==========================================

DROP VIEW IF EXISTS public.available_profiles;

CREATE OR REPLACE FUNCTION public.get_available_profiles()
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text,
  dept_text text,
  job_number text,
  username text,
  role text,
  admin_role text,
  department_id uuid,
  section_text text,
  unit_text text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- استخدام ::text لضمان توافق الأنواع (Varchar to Text) وتجنب خطأ PostgREST
  RETURN QUERY SELECT 
    p.id, 
    p.full_name::text, 
    p.avatar_url::text, 
    p.dept_text::text, 
    p.job_number::text, 
    p.username::text, 
    p.role::text, 
    p.admin_role::text, 
    p.department_id, 
    p.section_text::text, 
    p.unit_text::text
  FROM public.profiles p;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_available_profiles() TO authenticated;

CREATE VIEW public.available_profiles AS 
SELECT * FROM public.get_available_profiles();

GRANT SELECT ON public.available_profiles TO authenticated;

-- تحديث Schema Cache الخاص بـ Supabase ليقرأ التعديل فوراً
NOTIFY pgrst, 'reload schema';
