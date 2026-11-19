SELECT p.proname, pg_get_userbyid(p.proowner) as owner, pg_get_function_identity_arguments(p.oid) as args
FROM pg_proc p 
WHERE p.proname = 'submit_service_continuity_request';
