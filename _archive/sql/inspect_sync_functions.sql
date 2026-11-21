SELECT proname, prosrc FROM pg_proc WHERE proname IN (
    'sync_dept_manager_assignment',
    'sync_profile_to_work_location_and_manager',
    'sync_work_location_emp_to_profile'
);
