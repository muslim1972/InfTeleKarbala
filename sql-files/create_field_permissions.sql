-- Script to create the field_permissions table and insert default data

-- 1. Create the field_permissions table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.field_permissions (
    column_name text PRIMARY KEY,
    permission_level integer NOT NULL DEFAULT 4,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable RLS (Row Level Security)
ALTER TABLE public.field_permissions ENABLE ROW LEVEL SECURITY;

-- 3. Create policies for the table
-- Allow anyone authenticated to read
CREATE POLICY "Allow authenticated users to read field_permissions"
    ON public.field_permissions
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow only specific admin to insert/update/delete (or all admins depending on your current RLS setup)
-- Here we allow authenticated users to modify, but you should restrict it in the UI to Muslim Aqeel
CREATE POLICY "Allow authenticated users to modify field_permissions"
    ON public.field_permissions
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 4. Insert default fields from financial_records
-- We'll insert the main fields with a default level of 4 (عام)
INSERT INTO public.field_permissions (column_name, permission_level)
VALUES 
    ('job_title', 4),
    ('salary_grade', 4),
    ('salary_stage', 4),
    ('certificate_text', 4),
    ('certificate_percentage', 4),
    ('nominal_salary', 4),
    ('risk_percentage', 4),
    ('certificate_allowance', 4),
    ('engineering_allowance', 4),
    ('legal_allowance', 4),
    ('transport_allowance', 4),
    ('marital_allowance', 4),
    ('children_allowance', 4),
    ('position_allowance', 4),
    ('risk_allowance', 4),
    ('additional_50_percent_allowance', 4),
    ('tax_deduction_status', 4),
    ('tax_deduction_amount', 4),
    ('loan_deduction', 4),
    ('execution_deduction', 4),
    ('retirement_deduction', 4),
    ('school_stamp_deduction', 4),
    ('social_security_deduction', 4),
    ('other_deductions', 4)
ON CONFLICT (column_name) DO NOTHING;

-- 5. Add supervisor_level to profiles table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'supervisor_level') THEN
        ALTER TABLE public.profiles ADD COLUMN supervisor_level integer DEFAULT 4;
    END IF;
END $$;
