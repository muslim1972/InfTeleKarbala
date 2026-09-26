docker exec supabase-db psql -U postgres -d postgres -c "SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'handle_leave_state_machine';"
