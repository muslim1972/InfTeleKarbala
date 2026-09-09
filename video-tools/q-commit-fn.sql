-- q-commit-fn.sql
SELECT pg_get_functiondef(p.oid)
FROM pg_proc p
WHERE p.proname IN ('commit_monthly_snapshot','delete_monthly_snapshot');
