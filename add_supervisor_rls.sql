-- Enable supervisors to see requests assigned to them
CREATE POLICY "Supervisors can view assigned leave requests"
ON public.leave_requests
FOR SELECT
USING (auth.uid() = supervisor_id);

-- Also allow them to update status (approve/reject)
CREATE POLICY "Supervisors can update assigned leave requests"
ON public.leave_requests
FOR UPDATE
USING (auth.uid() = supervisor_id)
WITH CHECK (auth.uid() = supervisor_id);
