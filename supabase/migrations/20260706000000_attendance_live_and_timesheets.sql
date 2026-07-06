-- supabase/migrations/20260706000000_attendance_live_and_timesheets.sql

-- 1. Add indexes to speed up Timesheets and Live Board
CREATE INDEX IF NOT EXISTS idx_attendance_check_in ON public.attendance_records(check_in DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_department ON public.attendance_records(department_id);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON public.attendance_records(employee_id, check_in);

-- 2. RLS expansion for developer & general admin
-- The existing policy limits select to HR and Admins, but we want Developer and General to also see it.
CREATE POLICY "Developers and General can view all attendance" ON public.attendance_records
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.admin_role IN ('developer', 'general')
    )
  );

-- 3. Enable Realtime on attendance_records
-- We need to ensure attendance_records is in the realtime publication.
-- Check if the table is already in the publication before adding
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'attendance_records'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records;
  END IF;
END $$;
