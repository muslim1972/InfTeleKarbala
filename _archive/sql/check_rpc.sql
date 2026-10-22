\df search_available_profiles
SELECT proname, proargnames, proargtypes, prosrc FROM pg_proc WHERE proname = 'search_available_profiles';
