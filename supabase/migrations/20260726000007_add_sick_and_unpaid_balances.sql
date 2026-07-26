-- Add sick_leaves_balance and unpaid_leaves_total to financial_records
ALTER TABLE public.financial_records
ADD COLUMN IF NOT EXISTS sick_leaves_balance INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS unpaid_leaves_total INTEGER DEFAULT 0;

-- Comments for documentation
COMMENT ON COLUMN public.financial_records.sick_leaves_balance IS 'Remaining sick leave balance for the current year (usually starts at 30)';
COMMENT ON COLUMN public.financial_records.unpaid_leaves_total IS 'Cumulative total of unpaid leave days taken by the employee';
