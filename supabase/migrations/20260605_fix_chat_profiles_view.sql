-- Drop the existing view
DROP VIEW IF EXISTS public.available_profiles;

-- Create a security definer function to securely fetch public profile data
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
  RETURN QUERY SELECT 
    p.id, 
    p.full_name, 
    p.avatar_url, 
    p.dept_text, 
    p.job_number, 
    p.username, 
    p.role, 
    p.admin_role, 
    p.department_id, 
    p.section_text, 
    p.unit_text
  FROM public.profiles p;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_available_profiles() TO authenticated;

-- Create the view using the function so it bypasses RLS for these specific columns
CREATE VIEW public.available_profiles AS 
SELECT * FROM public.get_available_profiles();

-- Grant select on the view
GRANT SELECT ON public.available_profiles TO authenticated;
