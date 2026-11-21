SELECT id, employee_id, check_in, check_out, status, notes, raw_punches
FROM attendance_records
WHERE employee_id IN ('a60ccbd2-1131-4ff0-8849-ab87fd9584b6', '9527573b-5d38-40dc-a616-e25d96eae965')
AND check_in >= '2026-11-19 00:00:00+03'
ORDER BY employee_id, check_in;
