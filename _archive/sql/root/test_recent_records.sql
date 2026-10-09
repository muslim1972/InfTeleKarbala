docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT id, employee_id, check_in, created_at FROM attendance_records ORDER BY created_at DESC LIMIT 5;"
