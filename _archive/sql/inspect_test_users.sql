SELECT id, username, full_name, role, admin_role, governorate 
FROM profiles 
WHERE username LIKE '%تجريب%' OR full_name LIKE '%تجريب%';
