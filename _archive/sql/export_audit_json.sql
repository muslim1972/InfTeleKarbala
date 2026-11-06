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
SELECT json_agg(row_to_json(t))
FROM (
    SELECT 
        p.id,
        p.full_name,
        p.username,
        p.job_number,
        p.password,
        p.department_id,
        d.name as dept_ref_name,
        d.level as dept_ref_level,
        p.dept_text,
        p.section_text,
        p.unit_text,
        mr.managed_depts,
        el.location_names as biometric_locations
    FROM public.profiles p
    LEFT JOIN dept_tree d ON d.id = p.department_id
    LEFT JOIN manager_roles mr ON mr.manager_id = p.id
    LEFT JOIN emp_locs el ON el.employee_id = p.id
    WHERE p.governorate = 'karbala'
    ORDER BY p.full_name
) t;
