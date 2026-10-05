docker exec supabase-db psql -U postgres -d postgres -tAc "SELECT crypt('kiosk123456', gen_salt('bf', 10)) = crypt('kiosk123456', crypt('kiosk123456', gen_salt('bf', 10)));"
