-- check5: final pre-migration intel (ASCII only)
\echo '=== clone_fn ==='
SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p WHERE p.proname='clone_departments_tree';

\echo '=== trigger_fns ==='
SELECT t.tgname AS trg, pg_get_functiondef(t.tgfoid) AS def
  FROM pg_trigger t
 WHERE t.tgrelid='departments'::regclass AND NOT t.tgisinternal;

\echo '=== wl_columns ==='
SELECT column_name, is_nullable, data_type, column_default
  FROM information_schema.columns
 WHERE table_name='work_locations'
 ORDER BY ordinal_position;

\echo '=== wl_all_rows ==='
SELECT governorate, id, name, latitude, longitude, radius_meters, is_active
  FROM work_locations ORDER BY governorate, id;

\echo '=== depts_l3plus_counts ==='
SELECT governorate, level, count(*) FROM departments WHERE level>=3 GROUP BY governorate, level ORDER BY governorate, level;

\echo '=== karbala_l3plus ==='
SELECT level, id, name FROM departments WHERE governorate='karbala' AND level>=3 ORDER BY level, id;

\echo '=== babil_l3plus ==='
SELECT level, id, name FROM departments WHERE governorate='babil' AND level>=3 ORDER BY level, id;

\echo '=== najaf_l3plus ==='
SELECT level, id, name FROM departments WHERE governorate='najaf' AND level>=3 ORDER BY level, id;

\echo '=== itpc_l3plus ==='
SELECT level, id, name FROM departments WHERE governorate='itpc_hq' AND level>=3 ORDER BY level, id;
