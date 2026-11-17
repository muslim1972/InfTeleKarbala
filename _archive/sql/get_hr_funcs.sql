SELECT p.proname, substring(pg_get_functiondef(p.oid) from 1 for 600) AS start_def
FROM pg_proc p 
JOIN pg_namespace n ON n.oid = p.pronamespace 
WHERE n.nspname = 'public' 
  AND p.proname IN (
    'mark_continuity_printed',
    'get_service_continuity_request_for_print',
    'process_service_continuity_hr_issue',
    'process_service_continuity_supervisor',
    'submit_service_continuity_request',
    'respond_to_substitute_request',
    'resolve_shift_absence_or_penalty'
  )
ORDER BY p.proname;
