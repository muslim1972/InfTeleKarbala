docker exec supabase-db psql -U postgres -d postgres -c "SELECT prosrc FROM pg_proc WHERE proname = 'handle_leave_state_machine';"
