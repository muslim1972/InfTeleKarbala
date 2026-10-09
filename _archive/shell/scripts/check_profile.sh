docker exec supabase-db psql -U postgres -d postgres -tAc "SELECT role FROM public.profiles WHERE id = (SELECT id FROM auth.users WHERE email = 'kiosk.system@inftelekarbala.iq');"
