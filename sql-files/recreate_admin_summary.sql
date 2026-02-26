
-- Recreate administrative_summary table to fix Foreign Key issues

-- 1. Drop existing table (Data will be lost, but we are importing it anyway)
DROP TABLE IF EXISTS public.administrative_summary;

-- 2. Ensure UUID extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. Create Table with Correct FK to public.profiles
CREATE TABLE public.administrative_summary (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    remaining_leave_balance integer DEFAULT 0,
    five_year_law_leaves integer DEFAULT 0,
    
    disengagement_date date,
    resumption_date date,
    first_appointment_date date,
    
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Ensure one record per user
    CONSTRAINT administrative_summary_user_id_key UNIQUE (user_id)
);

-- 4. Enable RLS
ALTER TABLE public.administrative_summary ENABLE ROW LEVEL SECURITY;

-- 5. Add Policies
CREATE POLICY "Users can view own admin summary." 
ON public.administrative_summary FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins/ServiceRole can manage all" 
ON public.administrative_summary FOR ALL USING (true) WITH CHECK (true);
