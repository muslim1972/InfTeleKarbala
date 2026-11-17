SELECT polname, polcmd, polroles::regrole[], polqual, polwithcheck
FROM pg_policy
WHERE polrelid = 'storage.objects'::regclass;
