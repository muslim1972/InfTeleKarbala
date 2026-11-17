SELECT p.proname, pg_get_functiondef(p.oid) AS definition
FROM pg_proc p 
JOIN pg_namespace n ON n.oid = p.pronamespace 
WHERE n.nspname = 'public' 
  AND p.proname IN ('approve_continuity_by_finance', 'reject_continuity_by_finance', 'update_and_approve_continuity_by_finance', 'mark_continuity_printed')
ORDER BY p.proname;
