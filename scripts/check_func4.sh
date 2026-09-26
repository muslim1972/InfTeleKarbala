docker exec supabase-db psql -U postgres -d postgres -c "SELECT prosrc FROM pg_proc WHERE proname = 'submit_time_leave_auto_converted';"
