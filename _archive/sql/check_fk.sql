SELECT conname, confrelid::regclass AS referenced_table, conrelid::regclass AS table_name
FROM pg_constraint 
WHERE conrelid = 'public.leave_history'::regclass;
