docker exec supabase-db psql -U postgres -d postgres -c "SELECT trigger_name, event_object_table, action_statement FROM information_schema.triggers WHERE event_object_table = 'leave_requests';"
