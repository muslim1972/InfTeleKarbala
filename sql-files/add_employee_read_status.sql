ALTER TABLE public.leave_requests 
ADD COLUMN IF NOT EXISTS is_read_by_employee BOOLEAN DEFAULT FALSE;
