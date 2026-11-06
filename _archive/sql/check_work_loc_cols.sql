-- فحص أعمدة work_locations و work_location_employees
SELECT 'work_locations' as tbl, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'work_locations'
UNION ALL
SELECT 'work_location_employees' as tbl, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'work_location_employees'
ORDER BY tbl, column_name;
