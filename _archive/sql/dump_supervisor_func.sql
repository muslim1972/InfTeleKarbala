SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'get_direct_supervisor_id';
