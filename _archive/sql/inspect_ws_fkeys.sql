SELECT 
    conname, 
    conrelid::regclass AS table_from, 
    confrelid::regclass AS table_to,
    pg_get_constraintdef(oid) AS def
FROM pg_constraint 
WHERE conrelid = 'public.work_schedules'::regclass;
