SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND (table_name LIKE '%gov%' OR table_name LIKE '%dir%' OR table_name LIKE '%setting%' OR table_name LIKE '%dept%' OR table_name LIKE '%continuity%');
