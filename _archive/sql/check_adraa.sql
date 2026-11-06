SELECT p.id, p.full_name, p.job_number, f.id as fin_id, f.user_id as fin_user_id
FROM public.profiles p
LEFT JOIN public.financial_records f ON f.user_id = p.id
WHERE p.job_number = '99990016';
