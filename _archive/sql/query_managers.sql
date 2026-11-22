SELECT 
    d.name, 
    d.level,
    pm.full_name as manager_name,
    pd.full_name as deputy_name
FROM departments d
LEFT JOIN profiles pm ON d.manager_id = pm.id
LEFT JOIN profiles pd ON d.deputy_manager_id = pd.id
WHERE d.governorate = 'karbala'
ORDER BY d.level, d.name;
