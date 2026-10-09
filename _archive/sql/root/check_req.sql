docker exec -i supabase-db psql -U postgres -d postgres -tAc "SELECT id, status, cancellation_status, cut_status FROM leave_requests WHERE id = 'dbd39a2c-c266-412d-bd51-27e376929e07';"
