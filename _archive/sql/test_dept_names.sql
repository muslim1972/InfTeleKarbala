SELECT 
    d.id, 
    d.name, 
    d.parent_id 
FROM departments d 
WHERE d.governorate = 'karbala' OR d.governorate IS NULL
ORDER BY d.name;