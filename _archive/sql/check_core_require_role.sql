SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'core_require_role';
