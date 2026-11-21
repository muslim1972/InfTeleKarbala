SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'work_locations' ORDER BY ordinal_position;
SELECT id, name, department_id, governorate FROM work_locations LIMIT 10;
