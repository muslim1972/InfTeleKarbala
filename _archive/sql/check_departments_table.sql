-- فحص أعمدة ومحتويات جدول departments
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'departments';

SELECT id, name, parent_id, governorate
FROM departments
WHERE governorate = 'karbala' OR governorate IS NULL
ORDER BY parent_id NULLS FIRST, name;
