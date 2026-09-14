SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname IN ('get_available_profiles', 'get_own_profile');
