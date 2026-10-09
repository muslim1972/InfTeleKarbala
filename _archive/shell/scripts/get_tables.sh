docker exec supabase-db psql -U postgres -d postgres -tAc "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;"
