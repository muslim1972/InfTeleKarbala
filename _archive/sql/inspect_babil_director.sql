SELECT d.id, d.name, d.manager_id, p.full_name, p.position_title 
FROM departments d
LEFT JOIN profiles p ON p.id = d.manager_id
WHERE d.governorate = 'babil' AND (d.name LIKE '%مدير%' OR d.name LIKE '%معاون%');

SELECT id, full_name, role, admin_role, department_id, position_title
FROM profiles 
WHERE governorate = 'babil' AND (position_title LIKE '%مدير%' OR position_title LIKE '%معاون%');
