SELECT id, name, level, parent_id, manager_id 
FROM public.departments 
WHERE governorate = 'karbala' 
ORDER BY level, name;
