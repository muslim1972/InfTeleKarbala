-- 1. Add governorate column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS governorate text;

-- 2. Update existing rows with 'karbala'
UPDATE public.profiles SET governorate = 'karbala' WHERE governorate IS NULL;

-- 3. Set NOT NULL constraint
ALTER TABLE public.profiles ALTER COLUMN governorate SET NOT NULL;

-- 4. Update the view to include governorate
DROP VIEW IF EXISTS public.available_profiles;

DROP FUNCTION IF EXISTS public.get_available_profiles();

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
  unit_text text,
  governorate text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
    p.unit_text::text,
    p.governorate::text
  FROM public.profiles p;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_available_profiles() TO authenticated;

CREATE VIEW public.available_profiles AS 
SELECT * FROM public.get_available_profiles();

GRANT SELECT ON public.available_profiles TO authenticated;
