docker exec -i supabase-db psql -U postgres -d postgres -tAc "ALTER PUBLICATION supabase_realtime ADD TABLE conversations, messages;"
