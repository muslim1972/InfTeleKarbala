docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT id, name, type FROM work_schedules;" -c "SELECT count(*) FROM work_schedule_days;"
