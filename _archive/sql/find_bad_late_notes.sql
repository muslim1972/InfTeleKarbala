SELECT id, employee_id, created_at, status, notes, raw_punches 
FROM attendance_records 
WHERE notes LIKE '%تأخير صباحي%' AND (notes LIKE '%عطلة%' OR notes LIKE '%استراحة%' OR created_at >= '2026-11-21 00:00:00+00');
