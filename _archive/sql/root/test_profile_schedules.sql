docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT count(*), work_schedule_id IS NOT NULL as has_schedule FROM profiles GROUP BY work_schedule_id IS NOT NULL;"
