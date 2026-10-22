\echo '=== COLUMNS OF system_notifications ==='
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'system_notifications';

\echo '=== APPROVAL CHAIN FOR MUSLIM AQEEL ==='
SELECT * FROM public.core_resolve_approval_chain('d2c4eef8-72cc-4dd1-a734-00d5ebe94f6d');

\echo '=== DEPARTMENT OF MUSLIM AQEEL ==='
SELECT d.id, d.name, d.parent_id, d.manager_id, p.full_name as manager_name
FROM public.departments d
LEFT JOIN public.profiles p ON p.id = d.manager_id
WHERE d.id = '22222222-2222-2222-2222-222222222222';
