SELECT id, full_name, username, job_number 
FROM profiles 
WHERE full_name LIKE 'صالح%' 
   OR full_name LIKE 'صلاح%'
ORDER BY full_name;
