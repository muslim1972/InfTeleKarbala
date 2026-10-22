SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'handle_leave_state_machine';
