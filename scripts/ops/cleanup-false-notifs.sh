#!/usr/bin/env bash
set -e

echo "=== 1. UNSCHEDULE PG_CRON JOB VIA CRON.UNSCHEDULE ==="
docker exec -i supabase-db psql -U supabase_admin -d postgres -c "
SELECT cron.unschedule(2);
" || docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT cron.unschedule('evaluate_morning_shift_daily');
"

echo "=== 2. VERIFY PG_CRON JOBS ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT jobid, schedule, command, active FROM cron.job;
"

echo "=== 3. COUNT FALSE NOTIFICATIONS BEFORE DELETION ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT type, metadata->>'record_date' AS rec_date, count(*)
FROM system_notifications
WHERE type IN ('attendance_morning_absence', 'attendance_morning_absence_supervisor')
  AND (metadata->>'record_date') IN ('2026-11-08', '2026-11-09')
  AND (metadata->>'eval_type') = 'morning_total_absence'
GROUP BY 1, 2;
"

echo "=== 4. DELETE FALSE NOTIFICATIONS ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "
DELETE FROM system_notifications
WHERE type IN ('attendance_morning_absence', 'attendance_morning_absence_supervisor')
  AND (metadata->>'record_date') IN ('2026-11-08', '2026-11-09')
  AND (metadata->>'eval_type') = 'morning_total_absence';
"

echo "=== 5. VERIFY NIBRAS NOTIFICATIONS NOW ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT id, type, title, created_at, is_read
FROM system_notifications
WHERE recipient_id = '3b81c019-ffba-4d3c-a39f-f850acccf151'
  AND created_at >= '2026-11-07 00:00:00+00'
ORDER BY created_at DESC;
"
