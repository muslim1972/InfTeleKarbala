#!/usr/bin/env bash
set -e

EMP_ID="3b81c019-ffba-4d3c-a39f-f850acccf151"

echo "=== 1. ATTENDANCE RECORDS FOR NIBRAS (2026-11-06 to 2026-11-09) ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT id, employee_id, check_in, check_out, status, notes, raw_punches, check_out_is_virtual, check_out_virtual_reason, created_at, updated_at
FROM attendance_records
WHERE employee_id = '$EMP_ID'
  AND (
    check_in >= '2026-11-06 00:00:00+03' 
    OR created_at >= '2026-11-06 00:00:00+03'
  )
ORDER BY created_at DESC;
"

echo "=== 2. NOTIFICATIONS FOR NIBRAS (2026-11-06 to 2026-11-09) ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT id, type, title, content, is_read, metadata, created_at
FROM system_notifications
WHERE recipient_id = '$EMP_ID'
  AND created_at >= '2026-11-06 00:00:00+03'
ORDER BY created_at DESC;
"

echo "=== 3. ALL NOTIFICATIONS CREATED AROUND 02:59 (ON 2026-11-08 and 2026-11-09) ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT 
  (created_at AT TIME ZONE 'Asia/Baghdad')::date AS baghdad_date,
  to_char(created_at AT TIME ZONE 'Asia/Baghdad', 'HH24:MI:SS') AS baghdad_time,
  type,
  title,
  count(*) AS total_sent
FROM system_notifications
WHERE created_at >= '2026-11-07 00:00:00+00'
GROUP BY 
  (created_at AT TIME ZONE 'Asia/Baghdad')::date,
  to_char(created_at AT TIME ZONE 'Asia/Baghdad', 'HH24:MI:SS'),
  type,
  title
ORDER BY baghdad_date DESC, baghdad_time DESC;
"

echo "=== 4. CRON RUN DETAILS FOR JOB 2 (evaluate_morning_shift_daily) ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT runid, job_pid, database, username, command, status, return_message, start_time, end_time
FROM cron.job_run_details
WHERE jobid = 2
ORDER BY start_time DESC
LIMIT 5;
"
