-- Helper query to inspect function definitions
-- Execute this in Supabase SQL editor
SELECT 
    p.proname as function_name,
    pg_get_function_result(p.oid) as result_type,
    pg_get_function_arguments(p.oid) as argument_types,
    p.prosrc as definition
FROM 
    pg_proc p 
JOIN 
    pg_namespace n ON p.pronamespace = n.oid 
WHERE 
    n.nspname = 'public' 
    AND p.proname = 'submit_leave_request';

-- Also check leave_requests table structure
SELECT 
    column_name, 
    data_type 
FROM 
    information_schema.columns 
WHERE 
    table_name = 'leave_requests' 
    AND table_schema = 'public';
