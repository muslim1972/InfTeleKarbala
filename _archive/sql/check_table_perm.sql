SELECT table_name, grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name IN ('available_profiles', 'profiles') AND grantee IN ('anon', 'authenticated');
