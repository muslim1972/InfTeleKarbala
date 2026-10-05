docker exec -i supabase-db psql -U postgres -d postgres -tAc "SELECT prosrc FROM pg_proc WHERE proname = 'process_daily_attendance';"
