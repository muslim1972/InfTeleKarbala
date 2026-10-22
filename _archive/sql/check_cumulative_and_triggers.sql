-- فحص أعمدة جدول financial_records وتريغرات leave_requests ودالة convert_cumulative_time
SELECT 
    column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'financial_records' 
  AND column_name LIKE '%cumulative%';

-- فحص التريغرات على leave_requests
SELECT 
    trigger_name, event_manipulation, action_statement, action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'leave_requests';

-- فحص هل توجد دالة convert_cumulative_time ومصدرها
SELECT 
    p.proname, pg_get_functiondef(p.oid) as def
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname IN ('convert_cumulative_time', 'handle_leave_state_machine')
  AND n.nspname = 'public';

-- فحص وظائف pg_cron الحالية
SELECT jobid, schedule, command, nodename, active 
FROM cron.job;
