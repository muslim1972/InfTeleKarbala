SELECT job_number, full_name, password, password_hash IS NOT NULL as has_hash FROM public.profiles WHERE job_number IN ('99990016', '103130486');
