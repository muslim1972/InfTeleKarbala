SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args, r.rolname AS owner
FROM pg_proc p 
JOIN pg_namespace n ON n.oid = p.pronamespace 
JOIN pg_roles r ON r.oid = p.proowner
WHERE n.nspname = 'public' 
  AND p.proname IN ('process_service_continuity_hr_issue', 'process_service_continuity_supervisor', 'reject_continuity_by_finance', 'rename_monthly_snapshot', 'resolve_shift_absence_or_penalty', 'submit_service_continuity_request', 'update_and_approve_continuity_by_finance');
