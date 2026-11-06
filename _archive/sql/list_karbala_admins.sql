SELECT id, full_name, job_number, role, admin_role 
FROM profiles 
WHERE governorate = 'karbala' AND (role = 'admin' OR admin_role IS NOT NULL);
