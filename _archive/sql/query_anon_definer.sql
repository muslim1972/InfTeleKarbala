SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p 
JOIN pg_namespace n ON n.oid = p.pronamespace 
WHERE n.nspname = 'public' 
  AND has_function_privilege('anon', p.oid, 'execute') 
  AND p.prosecdef 
ORDER BY p.proname;
