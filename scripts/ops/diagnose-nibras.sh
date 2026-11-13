#!/usr/bin/env bash
set -e

echo "=== 1. SERVER TIME & PG TIMEZONE ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT now() AS pg_now, CURRENT_TIME, CURRENT_DATE, current_setting('TIMEZONE') AS tz;"

echo "=== 2. PG_CRON JOBS & RECENT RUNS ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT jobid, schedule, command, nodename, nodeport, database, username, active FROM cron.job;"
docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT jobid, runid, job_pid, database, username, command, status, return_message, start_time, end_time FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;"

echo "=== 3. NIBRAS MAHMOUD PROFILE & DUTY TYPE ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT id, full_name, role, admin_role, duty_type, department_id, work_location_id, status 
FROM profiles 
WHERE full_name LIKE '%نبراس%' OR full_name LIKE '%محمود%';
"

echo "=== 4. NIBRAS ATTENDANCE RECORDS (2026-11-07 to 2026-11-09) ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT a.id, a.user_id, p.full_name, a.date, a.punch_time, a.punch_type, a.status, a.created_at
FROM attendance a
JOIN profiles p ON p.id = a.user_id
WHERE (p.full_name LIKE '%نبراس%')
  AND a.date >= '2026-11-07'
ORDER BY a.date, a.punch_time;
"

echo "=== 5. NIBRAS LEAVES / TIME-OFF (2026-11-07 to 2026-11-09) ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT l.id, p.full_name, l.start_date, l.end_date, l.leave_type, l.status
FROM leaves l
JOIN profiles p ON p.id = l.user_id
WHERE (p.full_name LIKE '%نبراس%')
  AND l.start_date <= '2026-11-09' AND l.end_date >= '2026-11-07';
"

echo "=== 6. NOTIFICATIONS FOR NIBRAS ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT n.id, p.full_name, n.title, n.content, n.type, n.created_at, n.is_read
FROM system_notifications n
JOIN profiles p ON p.id = n.recipient_id
WHERE (p.full_name LIKE '%نبراس%')
  AND n.created_at >= '2026-11-07'
ORDER BY n.created_at DESC;
"

echo "=== 7. TOTAL MORNING_ATTENDANCE_ALERT NOTIFICATIONS SENT (2026-11-07 to 2026-11-09) ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT type, date_trunc('hour', created_at) AS hour_sent, count(*)
FROM system_notifications
WHERE created_at >= '2026-11-07'
  AND (type = 'morning_attendance_alert' OR title LIKE '%تغيب%' OR title LIKE '%تأخير%')
GROUP BY type, date_trunc('hour', created_at)
ORDER BY hour_sent DESC;
"
