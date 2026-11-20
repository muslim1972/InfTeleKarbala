SELECT id, employee_id, check_in, check_out, status, notes, raw_punches, created_at 
FROM attendance_records 
WHERE employee_id = '9527573b-5d38-40dc-a616-e25d96eae965'
ORDER BY created_at DESC;
