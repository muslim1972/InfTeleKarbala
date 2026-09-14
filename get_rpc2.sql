SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'secure_change_password';
