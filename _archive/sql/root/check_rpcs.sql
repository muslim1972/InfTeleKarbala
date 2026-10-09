docker exec -i supabase-db psql -U postgres -d postgres -tAc "SELECT proname FROM pg_proc WHERE proname LIKE '%attendance%' OR proname LIKE '%absent%';"
