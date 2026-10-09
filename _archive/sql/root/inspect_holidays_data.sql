docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT * FROM public_holidays;" -c "SELECT * FROM official_holidays;"
