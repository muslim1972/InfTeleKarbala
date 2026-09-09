\echo '=== RAISE line inside stored function (must be clean Arabic) ==='
SELECT line
FROM pg_proc p, unnest(string_to_array(pg_get_functiondef(p.oid), chr(10))) AS line
WHERE p.oid = 'public.activate_monthly_snapshot(uuid)'::regprocedure AND line LIKE '%RAISE%';
