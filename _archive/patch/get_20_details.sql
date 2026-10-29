SELECT 
  p.job_number,
  p.full_name,
  f.job_title,
  f.certificate_text
FROM profiles p
LEFT JOIN financial_records f ON f.user_id = p.id
WHERE p.department_id IS NULL 
  AND p.id NOT IN (SELECT employee_id FROM work_location_employees) 
  AND (p.section_text IS NULL OR p.section_text = '') 
  AND (p.dept_text IS NULL OR p.dept_text = '')
  AND p.governorate = 'karbala'
ORDER BY p.full_name;
