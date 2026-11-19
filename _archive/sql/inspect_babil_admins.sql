SELECT id, full_name, role, admin_role, job_number 
FROM profiles 
WHERE governorate = 'babil' AND (role = 'admin' OR admin_role IS NOT NULL);
