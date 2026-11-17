SELECT polname, polcmd, polroles::regrole[], pg_get_expr(polqual, polrelid) AS qual
FROM pg_policy
WHERE polrelid = 'storage.objects'::regclass
  AND (polname LIKE '%Attendance%' OR polname LIKE '%chat-files%')
ORDER BY polname;
