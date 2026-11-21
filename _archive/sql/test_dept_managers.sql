SELECT d.name, d.level, p.full_name, wl.name AS location_name
FROM departments d
JOIN profiles p ON p.id = d.manager_id
LEFT JOIN work_locations wl ON wl.department_id = d.id
LIMIT 10;
