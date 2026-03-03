SELECT 
    trg.tgname AS trigger_name,
    tgenabled AS trigger_status, -- O = Origin (enabled), D = Disabled
    ns.nspname || '.' || proc.proname AS trigger_function,
    pg_get_triggerdef(trg.oid) AS trigger_definition
FROM 
    pg_trigger trg
JOIN 
    pg_class tbl ON trg.tgrelid = tbl.oid
JOIN 
    pg_proc proc ON trg.tgfoid = proc.oid
JOIN 
    pg_namespace ns ON proc.pronamespace = ns.oid
WHERE 
    tbl.relname = 'leave_requests'
    AND trg.tgname = 'on_leave_request_approval';
