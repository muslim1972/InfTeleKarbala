-- Add supervisor_id column to leave_requests
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leave_requests' AND column_name = 'supervisor_id') THEN
        ALTER TABLE public.leave_requests ADD COLUMN supervisor_id UUID REFERENCES auth.users(id);
    END IF;
END $$;
