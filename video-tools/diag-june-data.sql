-- diag-june-data.sql | ASCII only; first line swallows BOM
\echo '=== A) snapshots meta ==='
SELECT id, name, is_active, created_at, created_by
FROM public.monthly_snapshots ORDER BY created_at;

\echo ''
\echo '=== B) columns ==='
SELECT table_name, ordinal_position, column_name, data_type
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name IN ('financial_records','monthly_snapshot_financials')
ORDER BY table_name, ordinal_position;

\echo ''
\echo '=== C) sync_active_monthly_snapshot definition ==='
SELECT pg_get_functiondef('public.sync_active_monthly_snapshot()'::regprocedure);

\echo ''
\echo '=== D) june vs august snapshot content ==='
WITH j AS (SELECT data FROM public.monthly_snapshot_financials WHERE snapshot_id='9816a4d0-3ab7-450f-966a-7f0580645ce0'),
     a AS (SELECT data FROM public.monthly_snapshot_financials WHERE snapshot_id='75f6e11f-eb85-49f0-bada-1593402d09a3')
SELECT (SELECT count(*) FROM j) AS june_rows,
       (SELECT count(*) FROM a) AS aug_rows,
       (SELECT count(*) FROM j JOIN a ON j.data->>'id'=a.data->>'id') AS same_id_pairs,
       (SELECT count(*) FROM j JOIN a ON j.data->>'id'=a.data->>'id' AND j.data IS NOT DISTINCT FROM a.data) AS fully_identical;

\echo ''
\echo '=== E) live vs june snapshot content ==='
WITH j AS (SELECT data FROM public.monthly_snapshot_financials WHERE snapshot_id='9816a4d0-3ab7-450f-966a-7f0580645ce0'),
     l AS (SELECT to_jsonb(f.*) AS data FROM public.financial_records f)
SELECT (SELECT count(*) FROM j) AS june_rows,
       (SELECT count(*) FROM l) AS live_rows,
       (SELECT count(*) FROM j JOIN l ON j.data->>'id'=l.data->>'id') AS same_id_pairs,
       (SELECT count(*) FROM j JOIN l ON j.data->>'id'=l.data->>'id' AND j.data IS NOT DISTINCT FROM l.data) AS fully_identical;
