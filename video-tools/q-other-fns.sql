-- تعريف بقية دوال النسخ للتحقق من نمط الخطأ نفسه
\pset pager off
\echo '=== sync_active_monthly_snapshot ==='
SELECT pg_get_functiondef(oid) FROM pg_proc
WHERE proname = 'sync_active_monthly_snapshot' AND pronamespace = 'public'::regnamespace;

\echo '=== delete_monthly_snapshot ==='
SELECT pg_get_functiondef(oid) FROM pg_proc
WHERE proname = 'delete_monthly_snapshot' AND pronamespace = 'public'::regnamespace;

\echo '=== commit_monthly_snapshot ==='
SELECT pg_get_functiondef(oid) FROM pg_proc
WHERE proname = 'commit_monthly_snapshot' AND pronamespace = 'public'::regnamespace;
