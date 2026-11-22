SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'is_privileged_user';
