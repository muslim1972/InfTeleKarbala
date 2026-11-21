SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname IN ('sync_dept_manager_assignment', 'sync_profile_to_work_location_and_manager');
