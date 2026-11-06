SELECT 
    d.id, 
    d.name, 
    d.level, 
    d.parent_id,
    p.name AS parent_name,
    wl.id AS wl_id,
    wl.name AS wl_name
FROM departments d
LEFT JOIN departments p ON d.parent_id = p.id
LEFT JOIN work_locations wl ON wl.department_id = d.id
WHERE d.governorate = 'karbala'
ORDER BY d.level, d.name;
