docker exec -i supabase-db psql -U postgres -d postgres -tAc "SELECT metadata FROM system_notifications ORDER BY created_at DESC LIMIT 5;"
