SELECT 
    p.full_name,
    p.department_id,
    COALESCE((
        WITH RECURSIVE managed_depts AS (
            SELECT dept.id, dept.parent_id
            FROM public.departments dept
            WHERE dept.manager_id = p.id OR dept.deputy_manager_id = p.id
            UNION ALL
            SELECT c.id, c.parent_id
            FROM public.departments c
            JOIN managed_depts md ON c.parent_id = md.id
        ),
        all_authorized_depts AS (
            SELECT id FROM managed_depts
            UNION
            SELECT parent_id AS id FROM managed_depts WHERE parent_id IS NOT NULL
        ),
        all_locs AS (
            SELECT wle.location_id
            FROM public.work_location_employees wle
            WHERE wle.employee_id = p.id

            UNION

            SELECT wl.id AS location_id
            FROM public.work_locations wl
            WHERE wl.department_id IN (SELECT id FROM all_authorized_depts)
              AND wl.is_active = true
        )
        SELECT jsonb_agg(DISTINCT location_id)
        FROM all_locs
        WHERE location_id IS NOT NULL
    ), '[]'::jsonb) AS calculated_locs
FROM profiles p
WHERE EXISTS (SELECT 1 FROM departments d WHERE d.manager_id = p.id)
LIMIT 5;
