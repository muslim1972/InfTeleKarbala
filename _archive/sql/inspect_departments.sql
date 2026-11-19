SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'departments';

SELECT id, name, governorate, manager_id FROM departments LIMIT 20;
