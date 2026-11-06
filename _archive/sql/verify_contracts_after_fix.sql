-- التحقق من ربط موظفي العقود الـ 31
SELECT 
    p.job_number, 
    p.full_name, 
    p.dept_text, 
    p.section_text, 
    p.unit_text, 
    d.name as department_name,
    wl.name as biometric_location
FROM profiles p
LEFT JOIN departments d ON d.id = p.department_id
LEFT JOIN work_location_employees wle ON wle.employee_id = p.id
LEFT JOIN work_locations wl ON wl.id = wle.location_id
WHERE p.job_number LIKE '9999%'
ORDER BY p.job_number;
