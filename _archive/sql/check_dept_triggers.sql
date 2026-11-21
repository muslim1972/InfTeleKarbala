SELECT 
    event_object_table AS table_name,
    trigger_name,
    action_statement
FROM information_schema.triggers
WHERE event_object_table IN ('departments', 'profiles', 'work_location_employees', 'work_locations')
ORDER BY table_name, trigger_name;
