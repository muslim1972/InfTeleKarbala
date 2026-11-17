SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p 
JOIN pg_namespace n ON n.oid = p.pronamespace 
WHERE n.nspname = 'public' 
  AND p.proname IN (
    'cleanup_request_notifications_on_process',
    'core_enforce_governorate_notification_isolation',
    'fn_hash_summer_password',
    'fn_sync_profile_dept_texts',
    'fn_sync_profile_password_to_auth',
    'handle_leave_state_machine',
    'log_device_enrollment_changes',
    'log_field_changes',
    'log_leave_insert_history',
    'log_table_activity',
    'on_department_insert_ensure_location',
    'on_device_change_request_settled',
    'sync_available_profiles',
    'sync_department_manager_to_profile',
    'sync_dept_manager_assignment',
    'sync_printer_operator_flags',
    'sync_profile_dept_to_work_location',
    'sync_profile_to_work_location_and_manager',
    'sync_work_location_emp_to_profile',
    'sync_work_location_on_dept_rename',
    'sync_work_location_to_profile_dept',
    'sync_work_locations_on_department_rename',
    'trg_fn_accumulate_time_off',
    'update_yearly_records_counts',
    'work_locations_audit_trigger'
  )
ORDER BY p.proname;
