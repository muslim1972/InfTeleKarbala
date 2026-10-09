docker exec -i supabase-db psql -U postgres -d postgres -tAc "SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'submit_typed_leave_request';"
