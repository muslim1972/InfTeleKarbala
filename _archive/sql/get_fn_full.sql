SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'fn_sync_profile_dept_texts';