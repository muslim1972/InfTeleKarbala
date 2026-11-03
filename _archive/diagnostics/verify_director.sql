-- التحقق من علي عباس
SELECT p.id, p.full_name, p.job_number, p.dept_text, p.section_text, p.department_id, d.name as dept_name, wl.name as location_name
FROM profiles p
LEFT JOIN departments d ON d.id = p.department_id
LEFT JOIN work_location_employees wle ON wle.employee_id = p.id
LEFT JOIN work_locations wl ON wl.id = wle.location_id
WHERE p.job_number = '102484102';

-- التحقق من شعبة ادارة مكتب المدير
SELECT id, name, level, parent_id, (SELECT name FROM departments WHERE id = d.parent_id) as parent_name
FROM departments d
WHERE id = '44444444-1111-1111-1111-111111111111';
