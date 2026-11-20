SELECT id, full_name, role, admin_role, job_number, dept_text, section_text, department_id 
FROM profiles 
WHERE governorate = 'karbala' 
  AND (is_retired IS FALSE OR is_retired IS NULL)
  AND (dept_text IS NULL OR dept_text = '') 
  AND (section_text IS NULL OR section_text = '');