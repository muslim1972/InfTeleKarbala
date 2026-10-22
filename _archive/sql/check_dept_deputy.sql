SELECT id, name, level, parent_id, manager_id 
FROM departments 
WHERE name LIKE '%معاون%' OR name LIKE '%مكتب%'
ORDER BY name;
