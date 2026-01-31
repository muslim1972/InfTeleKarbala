-- Fix RLS Policies for Detailed Records Tables
-- This script drops existing insufficient policies and creates comprehensive ones for Admins.

-- 1. Thanks Details
DROP POLICY IF EXISTS "Users can view own thanks details" ON public.thanks_details;
DROP POLICY IF EXISTS "Admins can insert thanks details" ON public.thanks_details;
DROP POLICY IF EXISTS "Admins can update thanks details" ON public.thanks_details;
DROP POLICY IF EXISTS "Admins can manage thanks details" ON public.thanks_details;

CREATE POLICY "Users can view own thanks details" ON public.thanks_details 
    FOR SELECT USING (auth.uid() = user_id OR (SELECT role FROM public.app_users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can manage thanks details" ON public.thanks_details 
    FOR ALL USING ((SELECT role FROM public.app_users WHERE id = auth.uid()) = 'admin');


-- 2. Committees Details
DROP POLICY IF EXISTS "Users can view own committees details" ON public.committees_details;
DROP POLICY IF EXISTS "Admins can manage committees details" ON public.committees_details;

CREATE POLICY "Users can view own committees details" ON public.committees_details 
    FOR SELECT USING (auth.uid() = user_id OR (SELECT role FROM public.app_users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can manage committees details" ON public.committees_details 
    FOR ALL USING ((SELECT role FROM public.app_users WHERE id = auth.uid()) = 'admin');


-- 3. Penalties Details
DROP POLICY IF EXISTS "Users can view own penalties details" ON public.penalties_details;
DROP POLICY IF EXISTS "Admins can manage penalties details" ON public.penalties_details;

CREATE POLICY "Users can view own penalties details" ON public.penalties_details 
    FOR SELECT USING (auth.uid() = user_id OR (SELECT role FROM public.app_users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can manage penalties details" ON public.penalties_details 
    FOR ALL USING ((SELECT role FROM public.app_users WHERE id = auth.uid()) = 'admin');


-- 4. Leaves Details
DROP POLICY IF EXISTS "Users can view own leaves details" ON public.leaves_details;
DROP POLICY IF EXISTS "Admins can manage leaves details" ON public.leaves_details;

CREATE POLICY "Users can view own leaves details" ON public.leaves_details 
    FOR SELECT USING (auth.uid() = user_id OR (SELECT role FROM public.app_users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can manage leaves details" ON public.leaves_details 
    FOR ALL USING ((SELECT role FROM public.app_users WHERE id = auth.uid()) = 'admin');
