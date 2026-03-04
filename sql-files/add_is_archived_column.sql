-- Add an 'is_archived' flag to allow HR to hide processed leaves from their dashboard
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;
