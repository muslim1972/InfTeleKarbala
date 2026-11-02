#!/bin/bash
# فحص أمني + معماري: work_locations / work_location_employees
# التشغيل: bash _archive/shell/att07-audit-work-locations.sh
# يتطلب: على VPS مع حاوية supabase-db
C=$(docker ps --format '{{.Names}}' | grep -m1 db)

docker exec -i "$C" psql -U postgres -d postgres -v ON_ERROR_STOP=0 <<'SQL'
\echo '===== 1. COLUMN CATALOG ====='
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='work_locations'
ORDER BY ordinal_position;

\echo '===== 2. RLS STATE ====='
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class WHERE relname='work_locations';

\echo '===== 3. RLS POLICIES ====='
SELECT policyname, cmd, roles::text, qual, with_check
FROM pg_policies WHERE schemaname='public' AND tablename='work_locations'
ORDER BY policyname;

\echo '===== 4. RAW GRANTS (خطِر كامن) ====='
SELECT grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_name IN ('work_locations','work_location_employees')
  AND grantee IN ('anon','authenticated','public')
ORDER BY table_name, grantee, privilege_type;

\echo '===== 5. is_admin() ====='
SELECT pg_get_functiondef(p.oid) FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE p.proname='is_admin' LIMIT 1;

\echo '===== 6. get_my_governorate() (تثبيت search_path) ====='
SELECT pg_get_functiondef(p.oid) FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE p.proname='get_my_governorate' LIMIT 1;

\echo '===== 7. DATA DISTRIBUTION ====='
SELECT governorate, count(*) AS total,
       count(*) FILTER (WHERE is_active) AS active
FROM public.work_locations GROUP BY governorate ORDER BY 2 DESC;

SELECT count(DISTINCT name) AS distinct_names,
       min(radius_meters) AS r_min,
       max(radius_meters) AS r_max,
       round(avg(radius_meters)) AS r_avg
FROM public.work_locations;

\echo '===== 8. ANON ROLE SIMULATION ====='
SET ROLE anon;
SELECT count(*) AS anon_can_select FROM public.work_locations;
SELECT count(*) AS anon_can_select_wle FROM public.work_location_employees;
RESET ROLE;

\echo '===== 9. AUDIT TRAIL ====='
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND (table_name ILIKE '%audit%' OR table_name ILIKE '%log%');
SQL
