-- This query returns all triggers on the leave_requests table
SELECT 
    trg.tgname AS trigger_name,
    CASE trg.tgtype::integer & 66
        WHEN 2 THEN 'BEFORE'
        WHEN 64 THEN 'INSTEAD OF'
        ELSE 'AFTER'
    END || ' ' ||
    CASE trg.tgtype::integer & CAST(28 AS integer)
        WHEN 16 THEN 'UPDATE'
        WHEN  8 THEN 'DELETE'
        WHEN  4 THEN 'INSERT'
        WHEN 20 THEN 'INSERT OR UPDATE'
        WHEN 28 THEN 'INSERT OR UPDATE OR DELETE'
        WHEN 24 THEN 'UPDATE OR DELETE'
        WHEN 12 THEN 'INSERT OR DELETE'
    END AS trigger_event,
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
    AND NOT trg.tgisinternal;
