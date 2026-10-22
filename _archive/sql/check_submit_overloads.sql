SELECT proname, pg_get_function_identity_arguments(oid) 
FROM pg_proc 
WHERE proname = 'submit_typed_leave_request';
