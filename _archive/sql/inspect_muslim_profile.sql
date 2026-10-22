SELECT id, username, full_name, role, admin_role, governorate 
FROM profiles 
WHERE full_name LIKE '%مسلم%' OR username = 'مسلم';
