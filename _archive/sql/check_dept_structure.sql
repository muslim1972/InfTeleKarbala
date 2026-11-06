-- فحص جداول الهيكلية والمواقع
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND (table_name LIKE '%dept%' OR table_name LIKE '%work%' OR table_name LIKE '%location%' OR table_name LIKE '%struct%');
