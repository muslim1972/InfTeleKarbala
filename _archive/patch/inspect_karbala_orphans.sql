SELECT 
  job_number,
  full_name,
  role,
  admin_role
FROM profiles
WHERE department_id IS NULL 
  AND id NOT IN (SELECT employee_id FROM work_location_employees) 
  AND (section_text IS NULL OR section_text = '') 
  AND (dept_text IS NULL OR dept_text = '')
  AND governorate = 'karbala'
ORDER BY role, full_name;
