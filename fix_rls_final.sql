-- Final RLS Fix with Security Definer Function
-- This script creates a secure helper function to check admin status and reapplies policies.

-- 1. Create a secure function to check admin status
-- This function runs as the creator (system), ensuring it can read app_users regardless of other policies.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.app_users
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Grant permissions just in case
GRANT SELECT, INSERT, UPDATE, DELETE ON public.thanks_details TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.committees_details TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.penalties_details TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leaves_details TO authenticated;

-- 3. Re-apply Policies using the new safe function

-- Thanks Details
ALTER TABLE public.thanks_details ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own thanks details" ON public.thanks_details;
DROP POLICY IF EXISTS "Admins can manage thanks details" ON public.thanks_details;
DROP POLICY IF EXISTS "Admins can insert thanks details" ON public.thanks_details;
DROP POLICY IF EXISTS "Admins can update thanks details" ON public.thanks_details;

CREATE POLICY "Users can view own thanks details" ON public.thanks_details 
    FOR SELECT USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "Admins can manage thanks details" ON public.thanks_details 
    FOR ALL USING (is_admin());


-- Committees Details
ALTER TABLE public.committees_details ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own committees details" ON public.committees_details;
DROP POLICY IF EXISTS "Admins can manage committees details" ON public.committees_details;

CREATE POLICY "Users can view own committees details" ON public.committees_details 
    FOR SELECT USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "Admins can manage committees details" ON public.committees_details 
    FOR ALL USING (is_admin());


-- Penalties Details
ALTER TABLE public.penalties_details ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own penalties details" ON public.penalties_details;
DROP POLICY IF EXISTS "Admins can manage penalties details" ON public.penalties_details;

CREATE POLICY "Users can view own penalties details" ON public.penalties_details 
    FOR SELECT USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "Admins can manage penalties details" ON public.penalties_details 
    FOR ALL USING (is_admin());


-- Leaves Details
ALTER TABLE public.leaves_details ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own leaves details" ON public.leaves_details;
DROP POLICY IF EXISTS "Admins can manage leaves details" ON public.leaves_details;

CREATE POLICY "Users can view own leaves details" ON public.leaves_details 
    FOR SELECT USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "Admins can manage leaves details" ON public.leaves_details 
    FOR ALL USING (is_admin());

-- 4. Ensure app_users is readable by authenticated users (for search and self-check)
-- This is a fallback to ensure basic connectivity
CREATE POLICY "Authenticated users can read app_users" ON public.app_users
    FOR SELECT USING (auth.role() = 'authenticated');
