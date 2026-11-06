SELECT count(*) FROM public.profiles WHERE governorate = 'karbala';

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
    p.unit_text
FROM public.profiles p
LEFT JOIN public.departments d ON d.id = p.department_id
WHERE p.governorate = 'karbala' AND p.full_name LIKE '%مسلم عقيل%'
LIMIT 5;
