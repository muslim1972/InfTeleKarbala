-- Add 5-Year Leave columns to financial_records table

ALTER TABLE financial_records 
ADD COLUMN IF NOT EXISTS is_five_year_leave BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS leave_start_date DATE,
ADD COLUMN IF NOT EXISTS leave_end_date DATE;

-- Comment on columns for clarity
COMMENT ON COLUMN financial_records.is_five_year_leave IS 'Indicates if the employee is on a 5-year leave (no allowances)';
COMMENT ON COLUMN financial_records.leave_start_date IS 'Date when the 5-year leave started (Release Date)';
COMMENT ON COLUMN financial_records.leave_end_date IS 'Expected return date (Start Date + 5 Years)';
