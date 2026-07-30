-- Add is_mandatory flag to leave_requests to distinguish between requested and penalized time-offs
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS is_mandatory BOOLEAN DEFAULT false;
