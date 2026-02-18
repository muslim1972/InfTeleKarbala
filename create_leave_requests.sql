-- Create leave_requests table
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_count INTEGER NOT NULL CHECK (days_count > 0),
    reason TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- Create Policies

-- Users can view their own requests
CREATE POLICY "Users can view own leave requests"
ON public.leave_requests
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own requests
CREATE POLICY "Users can insert own leave requests"
ON public.leave_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can view all requests (Assuming admin logic based on previous files, typically using a function or role)
-- For now, we'll check if the user is an admin via a helper function if it exists, or just use service role on backend.
-- Checking previous policies... 
-- Usually: (auth.jwt() ->> 'role' = 'service_role') OR (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
-- I will add a policy for admins if the is_admin function exists, otherwise I'll stick to basic user policies and assume admins use specific tools.
-- Let's stick to user policies for now as requested by the feature scope.

-- Optional: If there is an admin role in profiles
-- CREATE POLICY "Admins can view all leave requests"
-- ON public.leave_requests
-- FOR ALL
-- USING (public.is_admin());
