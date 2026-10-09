-- Fix RLS policies for work_schedules and work_schedule_days to allow biometric and hr admins

DROP POLICY IF EXISTS "Admins can manage schedules" ON work_schedules;
CREATE POLICY "Admins can manage schedules" ON work_schedules
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin' 
      AND profiles.admin_role IN ('developer', 'general', 'biometric', 'hr_supervisor', 'hr')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin' 
      AND profiles.admin_role IN ('developer', 'general', 'biometric', 'hr_supervisor', 'hr')
    )
  );

DROP POLICY IF EXISTS "Admins can manage schedule days" ON work_schedule_days;
CREATE POLICY "Admins can manage schedule days" ON work_schedule_days
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin' 
      AND profiles.admin_role IN ('developer', 'general', 'biometric', 'hr_supervisor', 'hr')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin' 
      AND profiles.admin_role IN ('developer', 'general', 'biometric', 'hr_supervisor', 'hr')
    )
  );

-- Also ensure profiles work_schedule_id can be updated by biometric admin
DROP POLICY IF EXISTS "Profiles update access" ON profiles;
CREATE POLICY "Profiles update access" ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    (id = auth.uid()) OR 
    (get_my_admin_role() = ANY (ARRAY['developer'::text, 'general'::text, 'biometric'::text, 'hr_supervisor'::text])) OR 
    ((get_my_admin_role() = ANY (ARRAY['it_supervisor'::text, 'hr'::text])) AND (governorate = get_my_governorate()))
  )
  WITH CHECK (
    (id = auth.uid()) OR 
    (get_my_admin_role() = ANY (ARRAY['developer'::text, 'general'::text, 'biometric'::text, 'hr_supervisor'::text])) OR 
    ((get_my_admin_role() = ANY (ARRAY['it_supervisor'::text, 'hr'::text])) AND (governorate = get_my_governorate()))
  );
