ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS cancellation_reason text;
