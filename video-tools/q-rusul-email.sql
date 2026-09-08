SELECT p.job_number, p.email, u.id AS auth_uid
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.job_number = '102513365';
