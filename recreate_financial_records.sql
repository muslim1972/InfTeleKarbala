
-- Recreate financial_records table to fix Foreign Key issues

-- 1. Drop existing table
DROP TABLE IF EXISTS public.financial_records;

-- 2. Ensure UUID extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. Create Table with Correct FK to public.profiles
CREATE TABLE public.financial_records (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Job Info
  job_title text,
  salary_grade text,
  salary_stage text,

  -- Allowances
  tax_deduction_status text,
  tax_deduction_amount numeric,
  certificate_allowance numeric,
  engineering_allowance numeric,
  legal_allowance numeric,
  transport_allowance numeric,
  marital_allowance numeric,
  children_allowance numeric,

  -- Deductions
  loan_deduction numeric,
  execution_deduction numeric,
  retirement_deduction numeric,
  school_stamp_deduction numeric,
  social_security_deduction numeric,
  other_deductions numeric,

  -- Summary
  certificate_text text,
  certificate_percentage numeric,
  position_allowance numeric,
  risk_allowance numeric,
  additional_50_percent_allowance numeric,

  total_deductions numeric,
  nominal_salary numeric,
  gross_salary numeric,
  net_salary numeric,
  iban text,

  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Ensure one record per user
  CONSTRAINT financial_records_user_id_key UNIQUE (user_id)
);

-- 4. Enable RLS
ALTER TABLE public.financial_records ENABLE ROW LEVEL SECURITY;  

-- 5. Policies
CREATE POLICY "Users can view own financial records." 
ON public.financial_records FOR SELECT USING (auth.uid() = user_id);        

CREATE POLICY "Admins/ServiceRole can manage all" 
ON public.financial_records FOR ALL USING (true) WITH CHECK (true);
