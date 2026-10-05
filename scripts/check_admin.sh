docker exec supabase-db psql -U postgres -d postgres -tAc "SELECT admin_role, has_attendance_access FROM public.profiles WHERE full_name = 'test-attendance-admin';"
