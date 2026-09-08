-- زينب (قسم التجهيز مباشرة) وموظف خارجي: uid وقسمه
SELECT p.full_name, p.department_id
FROM public.profiles p
WHERE p.job_number IN ('102515291')  -- زينب: القسم مباشرة
   OR (p.department_id IS NOT NULL AND p.department_id NOT IN (
        '33333333-2222-2222-2222-222222222222',
        'f7b97974-c251-4eb9-b91f-4143ba08a38c',
        '3d03eb6a-1687-4002-9821-57678a760559'))
ORDER BY p.job_number
LIMIT 3;
