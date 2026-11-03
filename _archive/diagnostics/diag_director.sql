-- 1. علي عباس جاسم
SELECT id, full_name, job_number, department_id, dept_text, section_text, unit_text, governorate
FROM profiles 
WHERE full_name LIKE '%علي عباس جاسم%' OR job_number = '102484102';

-- 2. تشكيلات الهيكلية
SELECT id, name, level, parent_id, manager_id, governorate
FROM departments
WHERE name LIKE '%مدير%' OR name LIKE '%معاون%';

-- 3. موقع البصمة الحالي لعلي عباس
SELECT wle.id, wle.employee_id, wle.location_id, wl.name as location_name
FROM work_location_employees wle
JOIN work_locations wl ON wl.id = wle.location_id
WHERE wle.employee_id = (SELECT id FROM profiles WHERE job_number = '102484102');

-- 4. مواقع البصمة الخاصة بالمقر أو الإدارة العليا
SELECT id, name, radius_meters, governorate, is_active
FROM work_locations
WHERE name LIKE '%مدير%' OR name LIKE '%مكتب%' OR name LIKE '%قانون%';
