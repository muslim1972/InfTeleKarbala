SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'get_available_profiles_by_ids';
