UPDATE profiles 
SET department_id = '971279d5-f891-4446-af9f-24a89e37eb56',
    updated_at = NOW()
WHERE job_number = '99990005';

SELECT p.job_number, p.full_name, p.department_id, d.name AS dept_name, p.dept_text, p.section_text, p.unit_text
FROM profiles p
JOIN departments d ON p.department_id = d.id
WHERE p.job_number = '99990005';
