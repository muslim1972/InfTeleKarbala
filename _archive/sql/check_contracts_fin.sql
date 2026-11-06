SELECT count(*) FROM public.profiles p
LEFT JOIN public.financial_records f ON f.user_id = p.id
WHERE p.job_number LIKE '99990%' AND f.id IS NULL;
