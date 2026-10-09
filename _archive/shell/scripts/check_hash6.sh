docker exec supabase-db psql -U postgres -d postgres -tAc "SELECT (encrypted_password = crypt('kiosk123456', encrypted_password)) FROM auth.users WHERE email = 'kiosk.system@inftelekarbala.iq';"
