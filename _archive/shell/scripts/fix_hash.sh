docker exec supabase-db psql -U postgres -d postgres -c "UPDATE auth.users SET encrypted_password = crypt('kiosk123456', gen_salt('bf', 10)) WHERE email = 'kiosk.system@inftelekarbala.iq';"
