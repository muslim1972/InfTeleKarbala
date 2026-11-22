SELECT id, full_name, role, admin_role, department_id FROM profiles WHERE full_name LIKE '%اسيل%';
SELECT id, name, manager_id, deputy_manager_id FROM departments WHERE manager_id IN (SELECT id FROM profiles WHERE full_name LIKE '%اسيل%') OR deputy_manager_id IN (SELECT id FROM profiles WHERE full_name LIKE '%اسيل%');
