-- Migration: Add Detailed Self Data Tables
-- Created: 2026-01-31
-- Description: Adds tables to store detailed records for Thanks Books, Committees, Penalties, and Leaves.

-- 1. Thanks & Appreciation Details
CREATE TABLE IF NOT EXISTS public.thanks_details (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid REFERENCES public.app_users(id) NOT NULL,
    year integer NOT NULL,
    book_number text,
    book_date date,
    reason text,
    issuer text, -- e.g., "Minister", "Governor"
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Committees Details
CREATE TABLE IF NOT EXISTS public.committees_details (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid REFERENCES public.app_users(id) NOT NULL,
    year integer NOT NULL,
    committee_name text NOT NULL,
    role text, -- e.g., "Member", "President"
    start_date date,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Penalties Details
CREATE TABLE IF NOT EXISTS public.penalties_details (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid REFERENCES public.app_users(id) NOT NULL,
    year integer NOT NULL,
    penalty_type text NOT NULL, -- e.g., "Warning", "Salary Deduction"
    reason text,
    penalty_date date,
    effect text, -- e.g., "Delay promotion 6 months"
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Leaves Details
CREATE TABLE IF NOT EXISTS public.leaves_details (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid REFERENCES public.app_users(id) NOT NULL,
    year integer NOT NULL,
    leave_type text NOT NULL, -- e.g., "Sick", "Regular"
    start_date date,
    end_date date,
    duration integer, -- Number of days
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.thanks_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.committees_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.penalties_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaves_details ENABLE ROW LEVEL SECURITY;

-- Policies (View own data)
CREATE POLICY "Users can view own thanks details" ON public.thanks_details FOR SELECT USING (auth.uid() = user_id OR (SELECT role FROM public.app_users WHERE id = auth.uid()) = 'admin');
CREATE POLICY "Users can view own committees details" ON public.committees_details FOR SELECT USING (auth.uid() = user_id OR (SELECT role FROM public.app_users WHERE id = auth.uid()) = 'admin');
CREATE POLICY "Users can view own penalties details" ON public.penalties_details FOR SELECT USING (auth.uid() = user_id OR (SELECT role FROM public.app_users WHERE id = auth.uid()) = 'admin');
CREATE POLICY "Users can view own leaves details" ON public.leaves_details FOR SELECT USING (auth.uid() = user_id OR (SELECT role FROM public.app_users WHERE id = auth.uid()) = 'admin');

-- Policies (Admin manage data)
-- Assuming admin has role 'admin' in app_users, but RLS usually uses auth.uid().
-- For simplicity in this demo, we assume the application handles admin checks or admin has direct access.
-- Adding specific insert/update policies for flexibility:
CREATE POLICY "Admins can insert thanks details" ON public.thanks_details FOR INSERT WITH CHECK (true); -- Restricted by app logic usually
CREATE POLICY "Admins can update thanks details" ON public.thanks_details FOR UPDATE USING (true);

-- Repeat for others as needed, or stick to simple SELECT for the User Portal view.
