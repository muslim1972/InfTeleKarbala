SELECT 
    p.job_number,
    p.full_name,
    p.department_id,
    d.name AS dept_name,
    p.dept_text,
    p.section_text,
    p.unit_text,
    wl.name AS work_loc_name
FROM profiles p
LEFT JOIN departments d ON p.department_id = d.id
LEFT JOIN work_location_employees wle ON wle.employee_id = p.id
LEFT JOIN work_locations wl ON wle.location_id = wl.id
WHERE p.job_number LIKE '9999%'
ORDER BY p.job_number;
