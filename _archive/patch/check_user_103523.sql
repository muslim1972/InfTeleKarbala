SELECT 
    au.id, 
    au.email, 
    au.created_at, 
    au.raw_user_meta_data,
    p.job_number,
    p.full_name,
    p.governorate
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE au.email LIKE '%103523%' OR p.job_number = '103523';
