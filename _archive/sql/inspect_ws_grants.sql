SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name = 'work_schedules'
LIMIT 10;
