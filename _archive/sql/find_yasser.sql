SELECT id, full_name, job_number, role, admin_role, governorate 
FROM profiles 
WHERE full_name LIKE '%ياسر%عبد%الامير%' OR full_name LIKE '%ياسر%عبد%الأمير%';
