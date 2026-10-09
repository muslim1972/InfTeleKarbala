docker exec supabase-db psql -U postgres -d postgres -tAc "SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid = 'leave_requests'::regclass;"
