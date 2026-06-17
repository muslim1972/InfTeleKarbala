-- SQL Migration: Secure Available Profiles

-- 1. Drop existing permissive policy
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.available_profiles;
DROP POLICY IF EXISTS "Everyone can read available profiles" ON public.available_profiles;
DROP POLICY IF EXISTS "Authenticated users can read available profiles" ON public.available_profiles;

-- 2. Create strict policy: Users can only query their own row directly
CREATE POLICY "Users can read their own profile directly" ON public.available_profiles
FOR SELECT TO authenticated
USING (id = auth.uid());

-- 3. Create a SECURITY DEFINER function to allow searching profiles
CREATE OR REPLACE FUNCTION public.search_available_profiles(search_term text, limit_count int DEFAULT 20)
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
SECURITY DEFINER -- Runs with elevated privileges to bypass the restrictive RLS above
SET search_path = public
AS $$
BEGIN
    -- Require at least 2 characters for searching to prevent full table scraping
    IF length(trim(search_term)) < 2 THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        ap.id, ap.full_name, ap.avatar_url, ap.dept_text, ap.job_number, 
        ap.username, ap.role, ap.admin_role, ap.department_id, 
        ap.section_text, ap.unit_text, ap.governorate
    FROM public.available_profiles ap
    WHERE 
        ap.full_name ILIKE '%' || trim(search_term) || '%'
        OR ap.job_number ILIKE '%' || trim(search_term) || '%'
        OR ap.username ILIKE '%' || trim(search_term) || '%'
    ORDER BY ap.full_name ASC
    LIMIT limit_count;
END;
$$;

-- 4. Create a SECURITY DEFINER function to fetch specific profiles by IDs
CREATE OR REPLACE FUNCTION public.get_available_profiles_by_ids(profile_ids uuid[])
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
    -- Prevent fetching too many IDs at once (scraping prevention)
    IF array_length(profile_ids, 1) > 100 THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        ap.id, ap.full_name, ap.avatar_url, ap.dept_text, ap.job_number, 
        ap.username, ap.role, ap.admin_role, ap.department_id, 
        ap.section_text, ap.unit_text, ap.governorate
    FROM public.available_profiles ap
    WHERE ap.id = ANY(profile_ids);
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.search_available_profiles(text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_profiles_by_ids(uuid[]) TO authenticated;
