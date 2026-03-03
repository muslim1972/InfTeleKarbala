-- Fix RLS Policies for leave_requests to allow updating new columns

-- 1. Drop the existing policy that might be restricting updates
DROP POLICY IF EXISTS "Users can update their own leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Supervisors can update leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Departments managers can update leave requests" ON public.leave_requests;

-- 2. Re-create Supervisor/Manager Policy (Allowing updates to any field if they are the supervisor/manager)
CREATE POLICY "Supervisors can update leave requests"
ON public.leave_requests
FOR UPDATE
USING (
  auth.uid() = supervisor_id OR 
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE public.profiles.id = auth.uid() AND (public.profiles.role = 'manager' OR public.profiles.role = 'admin' OR public.profiles.role = 'developer')
  )
);

-- 3. Re-create Employee Policy (Allowing them to read/cancel/edit THEIR OWN pending requests)
CREATE POLICY "Users can update their own leave requests"
ON public.leave_requests
FOR UPDATE
USING (auth.uid() = user_id);

-- Verify policies
SELECT * FROM pg_policies WHERE tablename = 'leave_requests';
