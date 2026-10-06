SELECT a.id, a.employee_id, p.full_name, a.check_in, a.check_out, a.status, a.notes, a.created_at 
FROM attendance_records a
JOIN profiles p ON p.id = a.employee_id
WHERE a.check_in >= '2026-10-06T00:00:00Z' OR a.created_at >= '2026-10-06T00:00:00Z';

SELECT l.id, l.user_id, p.full_name, l.leave_type, l.start_date, l.end_date, l.status, l.is_mandatory, l.with_request, l.reason, l.created_at
FROM leave_requests l
JOIN profiles p ON p.id = l.user_id
WHERE l.start_date <= '2026-10-06' AND (l.end_date >= '2026-10-06' OR l.end_date IS NULL);
