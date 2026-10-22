SELECT proname, pg_get_function_identity_arguments(oid) as args, count(*) OVER () as total_versions
FROM pg_proc 
WHERE proname = 'submit_typed_leave_request';
