docker exec -i supabase-db psql -U postgres -d postgres -tAc "SELECT * FROM public_holidays WHERE date = '2026-10-02';"
