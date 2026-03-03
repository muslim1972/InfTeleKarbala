-- Fix the Check Constraints on leave_requests table
-- We need to ensure that 'canceled' is a valid status for all status columns.

-- 1. Drop existing check constraints related to status (if they exist)
ALTER TABLE public.leave_requests DROP CONSTRAINT IF EXISTS leave_requests_status_check;
ALTER TABLE public.leave_requests DROP CONSTRAINT IF EXISTS leave_requests_leave_status_check;
ALTER TABLE public.leave_requests DROP CONSTRAINT IF EXISTS leave_requests_cancellation_status_check;
ALTER TABLE public.leave_requests DROP CONSTRAINT IF EXISTS leave_requests_cut_status_check;

-- 2. Add new constraints that include 'canceled' as a valid Option
ALTER TABLE public.leave_requests ADD CONSTRAINT leave_requests_status_check 
CHECK (status IN ('pending', 'approved', 'rejected', 'canceled'));

ALTER TABLE public.leave_requests ADD CONSTRAINT leave_requests_leave_status_check 
CHECK (leave_status IN ('pending', 'approved', 'rejected', 'canceled'));

ALTER TABLE public.leave_requests ADD CONSTRAINT leave_requests_cancellation_status_check 
CHECK (cancellation_status IN ('none', 'pending', 'approved', 'rejected', 'canceled'));

ALTER TABLE public.leave_requests ADD CONSTRAINT leave_requests_cut_status_check 
CHECK (cut_status IN ('none', 'pending', 'approved', 'rejected', 'canceled'));

-- Just to be safe, also ensure modification_type is unrestricted or updated
ALTER TABLE public.leave_requests DROP CONSTRAINT IF EXISTS leave_requests_modification_type_check;
ALTER TABLE public.leave_requests ADD CONSTRAINT leave_requests_modification_type_check 
CHECK (modification_type IN ('none', 'edited', 'canceled', 'cut'));
