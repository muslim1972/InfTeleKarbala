SELECT id, name, parent_id, level, governorate 
FROM departments 
WHERE governorate = 'karbala' 
ORDER BY level, name;
