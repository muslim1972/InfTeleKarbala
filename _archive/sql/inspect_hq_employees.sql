SELECT p.id, p.full_name, p.department_id, d.name as dept_name, p.dept_text, p.section_text, p.unit_text
  FROM work_location_employees wle
  JOIN work_locations wl ON wl.id = wle.location_id
  JOIN profiles p ON p.id = wle.employee_id
  LEFT JOIN departments d ON d.id = p.department_id
 WHERE wl.name LIKE 'مقر مديرية%'
 ORDER BY p.full_name;
