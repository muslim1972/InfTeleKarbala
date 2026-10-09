docker exec supabase-db psql -U postgres -d postgres -tAc "SELECT crypt('kiosk', crypt('kiosk', gen_salt('bf')));"
