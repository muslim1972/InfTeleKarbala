SELECT r.employee_id, r.date, r.shift_type, r.notes, ws.name, ws.shift_type as ws_shift_type, ws.start_time, ws.end_time
FROM roster_assignments r
LEFT JOIN work_schedules ws ON r.work_schedule_id = ws.id
WHERE r.employee_id IN ('a60ccbd2-1131-4ff0-8849-ab87fd9584b6', '9527573b-5d38-40dc-a616-e25d96eae965')
AND r.date IN ('2026-11-20', '2026-11-21')
ORDER BY r.employee_id, r.date;
