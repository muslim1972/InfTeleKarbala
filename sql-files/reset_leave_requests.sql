-- WARNING: This script will delete ALL leave requests and reset leave balances!
-- Use ONLY in development/testing environments.

-- 1. Delete all history and details to avoid foreign key constraints
DELETE FROM public.leave_history;
DELETE FROM public.leaves_details;

-- 2. Delete all leave requests
DELETE FROM public.leave_requests;

-- 3. Reset financial records balances to a safe default for testing (350 days)
UPDATE public.financial_records
SET remaining_leaves_balance = 350,
    last_modified_at = NOW();

-- 4. Reset yearly stats (Optional, but good for a full clean)
UPDATE public.yearly_records
SET leaves_taken = 0,
    sick_leaves = 0,
    unpaid_leaves = 0,
    last_modified_at = NOW();

-- 5. Final confirmation
SELECT 'Successfully wiped all leave data and reset balances.' as status;
