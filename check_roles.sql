docker exec -i supabase-db psql -U postgres -d postgres -tAc "SELECT role, count(*) FROM profiles GROUP BY role;"
