-- 1. Fix missing UPDATE policy for employees to checkout
CREATE POLICY "Employees can update their own attendance"
    ON public.attendance_records FOR UPDATE
    USING (auth.uid() = employee_id)
    WITH CHECK (auth.uid() = employee_id);

-- 2. Secure the system cron function from being called via public API
REVOKE EXECUTE ON FUNCTION public.process_daily_attendance() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_daily_attendance() FROM anon;
REVOKE EXECUTE ON FUNCTION public.process_daily_attendance() FROM authenticated;
-- Only Postgres system user or service_role can execute it
