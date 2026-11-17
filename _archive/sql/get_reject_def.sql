SELECT p.proname, substring(pg_get_functiondef(p.oid) from 1 for 1500) AS start_def
FROM pg_proc p 
JOIN pg_namespace n ON n.oid = p.pronamespace 
WHERE n.nspname = 'public' 
  AND p.proname = 'reject_continuity_by_finance';
