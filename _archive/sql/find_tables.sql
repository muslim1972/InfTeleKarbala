SELECT table_name, column_name 
FROM information_schema.columns 
WHERE column_name IN ('full_name', 'employee_name', 'name') 
  AND table_schema = 'public';
