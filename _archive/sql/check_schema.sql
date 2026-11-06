SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name IN ('id', 'full_name', 'username', 'job_number', 'password', 'department_id', 'dept_text', 'section_text', 'unit_text', 'governorate');

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'departments';

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'work_locations';

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'work_location_employees';
