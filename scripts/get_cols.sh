docker exec supabase-db psql -U postgres -d postgres -tAc "SELECT column_name FROM information_schema.columns WHERE table_name='system_notifications';"
