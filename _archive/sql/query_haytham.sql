SELECT id, full_name, governorate, department_id, role, admin_role, job_number 
FROM profiles 
WHERE full_name LIKE '%هيثم%' OR governorate = 'babylon';
