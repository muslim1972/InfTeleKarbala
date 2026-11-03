SELECT id, email, created_at 
FROM auth.users 
WHERE email LIKE '%103523%' OR email LIKE '%صابرين%';

SELECT id, full_name, job_number, username, governorate 
FROM public.profiles 
WHERE job_number LIKE '%103523%' OR full_name LIKE '%صابرين%' OR username LIKE '%صابرين%';
