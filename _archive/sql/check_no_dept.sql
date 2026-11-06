SELECT 
    count(*) as total,
    count(department_id) as has_dept_id,
    count(*) filter (where department_id is null) as no_dept_id
FROM public.profiles 
WHERE governorate = 'karbala';

SELECT p.full_name, p.job_number, p.dept_text, p.section_text, p.unit_text
FROM public.profiles p
WHERE p.governorate = 'karbala' AND p.department_id IS NULL
LIMIT 10;
