docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args FROM pg_proc p WHERE p.proname = 'process_leave_approval';"
