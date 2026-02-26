-- Add new columns for Leaves Balance
ALTER TABLE public.financial_records 
ADD COLUMN IF NOT EXISTS remaining_leaves_balance integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS leaves_balance_expiry_date text;

-- Add comment to explain the columns
COMMENT ON COLUMN public.financial_records.remaining_leaves_balance IS 'Remaining leave balance days';
COMMENT ON COLUMN public.financial_records.leaves_balance_expiry_date IS 'Date up to which the balance is calculated (e.g. 2023-12-31)';
