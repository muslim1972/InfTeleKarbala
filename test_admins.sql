docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT id, full_name, username, role, admin_role, governorate FROM profiles WHERE role='admin';"
