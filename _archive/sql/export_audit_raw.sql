SELECT json_build_object(
    'departments', (
        SELECT json_agg(row_to_json(d))
        FROM (
            SELECT id, name, level, parent_id, manager_id
            FROM public.departments
            WHERE governorate = 'karbala'
            ORDER BY level, name
        ) d
    ),
    'profiles', (
        SELECT json_agg(row_to_json(p))
        FROM (
            SELECT 
                p.id,
                p.full_name,
                p.username,
                p.job_number,
                p.password,
                p.department_id,
                p.dept_text,
                p.section_text,
                p.unit_text
            FROM public.profiles p
            WHERE p.governorate = 'karbala'
            ORDER BY p.full_name
        ) p
    ),
    'locations', (
        SELECT json_agg(row_to_json(l))
        FROM (
            SELECT 
                wle.employee_id,
                string_agg(wl.name, ' | ' ORDER BY wl.name) as location_names
            FROM public.work_location_employees wle
            JOIN public.work_locations wl ON wl.id = wle.location_id
            GROUP BY wle.employee_id
        ) l
    )
);
