-- inspect departments hierarchy
SELECT id, name, level, parent_id 
FROM departments 
ORDER BY level, name;

-- inspect work locations
SELECT id, name, code, type 
FROM work_locations 
ORDER BY name;

-- inspect contract employees in profiles
SELECT civil_id, full_name, department_id, dept_text, section_text, unit_text 
FROM profiles 
WHERE civil_id LIKE '9999%' 
ORDER BY civil_id;
