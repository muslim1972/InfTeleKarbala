SELECT id, name, governorate FROM public.work_locations WHERE governorate = 'karbala';

SELECT 
    wle.employee_id,
    p.full_name,
    p.job_number,
    wl.name as location_name
FROM public.work_location_employees wle
JOIN public.work_locations wl ON wl.id = wle.location_id
JOIN public.profiles p ON p.id = wle.employee_id
WHERE p.governorate = 'karbala' AND p.full_name LIKE '%مسلم عقيل%';
