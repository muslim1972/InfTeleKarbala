\echo '=== every DELETE/UPDATE line inside the 4 snapshot functions (check for missing WHERE) ==='
SELECT p.proname AS fn, line
FROM pg_proc p
CROSS JOIN LATERAL unnest(string_to_array(pg_get_functiondef(p.oid), chr(10))) AS line
WHERE p.proname IN ('activate_monthly_snapshot','sync_active_monthly_snapshot','commit_monthly_snapshot','delete_monthly_snapshot')
  AND (line ~* 'DELETE FROM' OR line ~* 'UPDATE ')
ORDER BY fn, line;
