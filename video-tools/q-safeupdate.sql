\echo '=== shared_preload_libraries ==='
SHOW shared_preload_libraries;
\echo '=== safeupdate extension installed? ==='
SELECT extname, extversion FROM pg_extension WHERE extname = 'safeupdate';
\echo '=== roles with safeupdate settings ==='
SELECT rolname, rolconfig FROM pg_roles
WHERE rolconfig IS NOT NULL AND array_to_string(rolconfig, ',') LIKE '%safeupdate%';
\echo '=== database-level settings ==='
SELECT datname, datconfig FROM pg_database WHERE datconfig IS NOT NULL;
\echo '=== function owners and superuser flag ==='
SELECT p.proname, r.rolname AS owner, r.rolsuper
FROM pg_proc p JOIN pg_roles r ON r.oid = p.proowner
WHERE p.proname IN ('activate_monthly_snapshot','sync_active_monthly_snapshot','commit_monthly_snapshot','delete_monthly_snapshot');
\echo '=== simulate safeupdate as non-superuser: bare DELETE must fail ==='
BEGIN;
SET LOCAL ROLE authenticated;
DELETE FROM public.financial_records WHERE false;
ROLLBACK;
