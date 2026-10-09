docker exec supabase-db psql -U postgres -d postgres -c "SELECT trigger_name, event_object_table FROM information_schema.triggers;"
