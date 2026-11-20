SELECT id, name, parent_id, governorate 
FROM departments 
WHERE governorate = 'karbala' OR governorate IS NULL
ORDER BY parent_id NULLS FIRST, name;