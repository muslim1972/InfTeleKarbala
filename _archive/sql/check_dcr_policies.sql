SELECT polname, polcmd, polroles::regrole[], polqual, polwithcheck 
FROM pg_policy 
WHERE polrelid = 'device_change_requests'::regclass;
