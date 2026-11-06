SELECT id, job_number, full_name, dept_text, section_text, unit_text, department_id 
FROM profiles 
WHERE full_name LIKE '%جلنار%' OR full_name LIKE '%اكرم%' OR full_name LIKE '%اروى%';
