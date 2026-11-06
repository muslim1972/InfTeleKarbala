WITH dept_tree AS (
    SELECT id, name, level, manager_id, parent_id
    FROM public.departments
    WHERE governorate = 'karbala'
),
emp_locs AS (
    SELECT 
        wle.employee_id,
        string_agg(wl.name, ' | ' ORDER BY wl.name) as location_names
    FROM public.work_location_employees wle
    JOIN public.work_locations wl ON wl.id = wle.location_id
    GROUP BY wle.employee_id
),
manager_roles AS (
    SELECT 
        manager_id,
        string_agg('مسؤول ' || name || ' (مستوى ' || level || ')', ' | ') as managed_depts
    FROM dept_tree
    WHERE manager_id IS NOT NULL
    GROUP BY manager_id
)
SELECT 
    p.id,
    p.full_name,
    p.username,
    p.job_number,
    COALESCE(NULLIF(p.password, ''), 'مشفرة في خادم الهوية (Auth)') as password_display,
    CASE 
        WHEN d.name IS NOT NULL THEN d.name || ' (مستوى ' || d.level || ')'
        ELSE 'غير محدد'
    END as admin_formation,
    COALESCE(NULLIF(TRIM(p.dept_text), ''), 'غير محدد') as dept_text,
    COALESCE(NULLIF(TRIM(p.section_text), ''), 'غير محدد') as section_text,
    COALESCE(NULLIF(TRIM(p.unit_text), ''), 'غير محدد') as unit_text,
    CASE
        WHEN mr.managed_depts IS NOT NULL THEN mr.managed_depts
        WHEN d.name IS NOT NULL THEN d.name || ' (مستوى ' || d.level || ')'
        ELSE 'غير مرتبط في الهيكلية'
    END as hierarchy_link,
    COALESCE(el.location_names, 'غير مرتبط بموقع بصمة') as biometric_location
FROM public.profiles p
LEFT JOIN dept_tree d ON d.id = p.department_id
LEFT JOIN manager_roles mr ON mr.manager_id = p.id
LEFT JOIN emp_locs el ON el.employee_id = p.id
WHERE p.governorate = 'karbala'
ORDER BY p.full_name
LIMIT 10;
