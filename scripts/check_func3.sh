docker exec supabase-db psql -U postgres -d postgres -c "SELECT prosrc FROM pg_proc WHERE proname = 'submit_typed_leave_request';"
