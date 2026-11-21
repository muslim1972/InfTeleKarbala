SELECT polname, polcmd, polroles::regrole[], pg_get_expr(polqual, polrelid) AS qual, pg_get_expr(polwithcheck, polrelid) AS with_check
FROM pg_policy 
WHERE polrelid = 'storage.objects'::regclass AND polname LIKE '%Attendance Snapshots%';
