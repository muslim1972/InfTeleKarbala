SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p 
JOIN pg_namespace n ON n.oid = p.pronamespace 
WHERE n.nspname = 'public' 
  AND p.proname IN (
    'approve_continuity_by_finance',
    'reject_continuity_by_finance',
    'update_and_approve_continuity_by_finance',
    'mark_continuity_printed',
    'get_service_continuity_request_for_print',
    'process_service_continuity_hr_issue',
    'process_service_continuity_supervisor',
    'submit_service_continuity_request',
    'respond_to_substitute_request',
    'resolve_shift_absence_or_penalty',
    'toggle_requests_tab_all',
    'get_requests_tab_all_status',
    'get_unspecified_gender_profiles',
    'rename_monthly_snapshot',
    'admin_create_kiosk_device',
    'admin_delete_kiosk_device',
    'create_training_student',
    'get_active_visitors_by_range',
    'get_admin_stats_v1',
    'search_available_profiles'
  )
ORDER BY p.proname;
