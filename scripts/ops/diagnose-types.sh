#!/usr/bin/env bash
set -e

echo "=== BREAKDOWN OF NOTIFICATIONS SENT BY THE NEW ENGINE ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT 
  type, 
  title, 
  metadata->>'eval_type' AS eval_type,
  metadata->>'record_date' AS record_date,
  count(*) AS count
FROM system_notifications
WHERE type LIKE 'attendance_morning_%'
GROUP BY 1, 2, 3, 4
ORDER BY 4 DESC, 1;
"
