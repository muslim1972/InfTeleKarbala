SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'submit_typed_leave_request' 
  AND pg_get_function_identity_arguments(oid) LIKE '%substitute_id%';
