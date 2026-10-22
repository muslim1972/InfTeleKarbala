docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT routine_name, grantee, privilege_type FROM information_schema.routine_privileges WHERE routine_name = 'search_available_profiles';"
