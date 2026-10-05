docker exec -i supabase-db psql -U postgres -d postgres -tAc "SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'leave_requests';"
