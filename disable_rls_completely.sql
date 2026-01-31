-- NUCLEAR OPTION: Disable RLS completely for testing
-- Run this in Supabase SQL Editor if policies are still failing.

ALTER TABLE public.thanks_details DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.committees_details DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.penalties_details DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaves_details DISABLE ROW LEVEL SECURITY;
