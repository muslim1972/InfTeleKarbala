SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND (table_name LIKE '%roster%' OR table_name LIKE '%schedule%' OR table_name LIKE '%shift%');
