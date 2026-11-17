SELECT polname, polcmd, polroles::regrole[], pg_get_expr(polqual, polrelid) AS qual
FROM pg_policy
WHERE polrelid = 'storage.objects'::regclass
ORDER BY polname;
