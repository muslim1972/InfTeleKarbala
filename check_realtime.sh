docker exec -i supabase-db psql -U postgres -d postgres -tAc "SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';"
