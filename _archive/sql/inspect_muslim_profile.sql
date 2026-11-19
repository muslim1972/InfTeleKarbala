SELECT id, full_name, role, admin_role, governorate 
FROM public.profiles 
WHERE full_name LIKE '%مسلم عقيل%' 
LIMIT 5;
