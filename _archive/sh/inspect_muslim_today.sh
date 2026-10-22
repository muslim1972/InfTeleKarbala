#!/bin/bash
docker exec -i supabase-db psql -U supabase_admin -d postgres << 'EOF'
\x on
SELECT id, full_name, email, work_schedule_id FROM profiles WHERE full_name LIKE '%مسلم%' OR email LIKE '%muslim%';

SELECT a.id, a.employee_id, a.date, a.check_in, a.check_out, a.time_leave_out, a.time_leave_return, a.status, a.notes, a.created_at
FROM attendance a
JOIN profiles p ON p.id = a.employee_id
WHERE (p.full_name LIKE '%مسلم%' OR p.email LIKE '%muslim%')
  AND a.date = '2026-10-15';

SELECT l.id, l.user_id, l.leave_type, l.time_off_subtype, l.time_duration_minutes, l.leave_start_time, l.leave_end_time, l.status, l.leave_status, l.is_mandatory, l.with_request, l.reason, l.days_count
FROM leave_requests l
JOIN profiles p ON p.id = l.user_id
WHERE (p.full_name LIKE '%مسلم%' OR p.email LIKE '%muslim%')
  AND l.start_date <= '2026-10-15' AND (l.end_date >= '2026-10-15' OR l.end_date IS NULL);
EOF
