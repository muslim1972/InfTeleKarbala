SELECT id, full_name, job_number, role, admin_role, can_view_requests, department_id, dept_text, section_text 
FROM profiles 
WHERE full_name LIKE '%فراس عجيب%' OR job_number = '103131364';
