docker exec supabase-db psql -U postgres -d postgres -tAc "SELECT id, email FROM auth.users WHERE id IN (SELECT id FROM public.profiles WHERE role = 'kiosk');"
