SELECT id, full_name, username, job_number 
FROM profiles 
WHERE full_name LIKE '%عبد%الحسن%عبود%' 
   OR full_name LIKE '%عبد%الحسين%عبود%'
   OR full_name LIKE '%الكريطي%';
