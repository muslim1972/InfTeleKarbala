SELECT id, full_name, department_id 
FROM profiles 
WHERE full_name LIKE '%بشير%' OR full_name LIKE '%تجريبي%'
ORDER BY full_name;
