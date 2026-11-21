SELECT id, employee_id, created_at, status, check_in, check_out, notes
FROM attendance_records
WHERE created_at >= '2026-11-20T21:00:00Z' AND created_at <= '2026-11-21T21:00:00Z';
