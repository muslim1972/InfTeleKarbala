docker exec supabase-db psql -U postgres -d postgres -tAc "SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'admin_set_kiosk_password';"
