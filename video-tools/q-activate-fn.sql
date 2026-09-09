-- تعريف دوال النسخ الشهرية
\pset pager off
\echo '=== قائمة دوال snapshot ==='
SELECT proname, pg_get_function_identity_arguments(oid) AS args
FROM pg_proc
WHERE proname LIKE '%snapshot%'
  AND pronamespace = 'public'::regnamespace;

\echo '=== تعريف activate_monthly_snapshot ==='
SELECT pg_get_functiondef(oid) FROM pg_proc
WHERE proname = 'activate_monthly_snapshot'
  AND pronamespace = 'public'::regnamespace;
