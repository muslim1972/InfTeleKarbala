SELECT id, full_name, department_id FROM public.profiles WHERE full_name LIKE '%بشير%' OR id = auth.uid();
