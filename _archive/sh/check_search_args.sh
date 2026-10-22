docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT * FROM search_available_profiles('تجر', 20, 'karbala');"
