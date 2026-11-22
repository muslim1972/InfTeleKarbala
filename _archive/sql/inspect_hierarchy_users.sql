SELECT p.id, p.full_name, p.department_id, d.name as dept_name, d.parent_id, d.manager_id, d.deputy_manager_id
FROM profiles p
LEFT JOIN departments d ON p.department_id = d.id
WHERE p.full_name LIKE '%ميثاق%' OR p.full_name LIKE '%بشير%' OR p.full_name LIKE '%حيدر سعدون%' OR p.full_name LIKE '%جيهان%';
