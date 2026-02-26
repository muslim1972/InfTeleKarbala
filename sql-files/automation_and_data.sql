-- 0. Add the new column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financial_records' AND column_name = 'total_allowances') THEN 
        ALTER TABLE public.financial_records ADD COLUMN total_allowances numeric DEFAULT 0; 
    END IF; 
END $$;

-- 1. Create Calculation Function
CREATE OR REPLACE FUNCTION calculate_financial_totals()
RETURNS TRIGGER AS $$
BEGIN
    -- A. Calculate Total Deductions
    NEW.total_deductions := 
        COALESCE(NEW.tax_deduction_amount, 0) +
        COALESCE(NEW.loan_deduction, 0) +
        COALESCE(NEW.execution_deduction, 0) +
        COALESCE(NEW.retirement_deduction, 0) +
        COALESCE(NEW.school_stamp_deduction, 0) +
        COALESCE(NEW.social_security_deduction, 0) +
        COALESCE(NEW.other_deductions, 0);

    -- B. Calculate Total Allowances
    NEW.total_allowances := 
        COALESCE(NEW.certificate_allowance, 0) +
        COALESCE(NEW.engineering_allowance, 0) +
        COALESCE(NEW.legal_allowance, 0) +
        COALESCE(NEW.transport_allowance, 0) +
        COALESCE(NEW.marital_allowance, 0) +
        COALESCE(NEW.children_allowance, 0) +
        COALESCE(NEW.position_allowance, 0) +
        COALESCE(NEW.risk_allowance, 0) +
        COALESCE(NEW.additional_50_percent_allowance, 0);

    -- C. Calculate Gross Salary (Nominal + Total Allowances)
    NEW.gross_salary := COALESCE(NEW.nominal_salary, 0) + NEW.total_allowances;

    -- D. Calculate Net Salary (Gross - Total Deductions)
    NEW.net_salary := NEW.gross_salary - NEW.total_deductions;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create Trigger
DROP TRIGGER IF EXISTS trigger_calculate_financials ON public.financial_records;
CREATE TRIGGER trigger_calculate_financials
BEFORE INSERT OR UPDATE ON public.financial_records
FOR EACH ROW
EXECUTE FUNCTION calculate_financial_totals();

-- 3. Populate Data for All 5 Users
TRUNCATE TABLE public.financial_records;

-- User 1: Ahmed (Engineer)
INSERT INTO public.financial_records (user_id, job_title, salary_grade, salary_stage, nominal_salary, certificate_allowance, engineering_allowance, transport_allowance, tax_deduction_amount, retirement_deduction, iban)
SELECT id, 'مهندس اقدم', 'الثالثة', '4', 680000, 100000, 150000, 30000, 15000, 68000, 'IQ33IBIB1234567890123456'
FROM public.app_users WHERE username = 'user1';

-- User 2: Sara (Programmer - Married, Kids)
INSERT INTO public.financial_records (user_id, job_title, salary_grade, salary_stage, nominal_salary, marital_allowance, children_allowance, position_allowance, retirement_deduction, loan_deduction)
SELECT id, 'رئيس مبرمجين', 'الثانية', '2', 920000, 50000, 40000, 150000, 92000, 250000
FROM public.app_users WHERE username = 'user2';

-- User 3: Ali (Legal - High Risk)
INSERT INTO public.financial_records (user_id, job_title, salary_grade, salary_stage, nominal_salary, legal_allowance, risk_allowance, transport_allowance, retirement_deduction)
SELECT id, 'مشاور قانوني', 'الرابعة', '1', 590000, 200000, 100000, 0, 59000
FROM public.app_users WHERE username = 'user3';

-- User 4: Maryam (Junior - Simple)
INSERT INTO public.financial_records (user_id, job_title, salary_grade, salary_stage, nominal_salary, transport_allowance, retirement_deduction, school_stamp_deduction)
SELECT id, 'ملاحظ فني', 'السابعة', '1', 296000, 30000, 29600, 1000
FROM public.app_users WHERE username = 'user4';

-- User 5: Admin User (Manager)
INSERT INTO public.financial_records (user_id, job_title, salary_grade, salary_stage, nominal_salary, position_allowance, certificate_allowance, retirement_deduction, tax_deduction_amount)
SELECT id, 'مدير قسم', 'الاولى', '1', 1100000, 250000, 100000, 110000, 50000
FROM public.app_users WHERE username = 'user5';
