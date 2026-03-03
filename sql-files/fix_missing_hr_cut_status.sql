-- SQL Script to fix existing leave requests that were cut and approved
-- but did not have their hr_cut_status set to 'pending'.

UPDATE public.leave_requests
SET hr_cut_status = 'pending'
WHERE cut_status = 'approved' AND hr_cut_status = 'none';
