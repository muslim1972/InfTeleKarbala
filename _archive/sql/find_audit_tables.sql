SELECT table_name 
FROM information_schema.tables 
WHERE table_name LIKE '%audit%' OR table_name LIKE '%log%' OR table_name LIKE '%history%';
