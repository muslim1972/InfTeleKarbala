#!/usr/bin/env bash
set -e

echo "=== NOTIFICATIONS ON 2026-11-09 AROUND 02:59 ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT 
  (created_at AT TIME ZONE 'Asia/Baghdad')::date AS b_date,
  to_char(created_at AT TIME ZONE 'Asia/Baghdad', 'HH24:MI:SS') AS b_time,
  type,
  title,
  count(*) AS total_count
FROM system_notifications
WHERE created_at >= '2026-11-08 20:00:00+00'
GROUP BY 1, 2, 3, 4
ORDER BY 1 DESC, 2 DESC;
"
