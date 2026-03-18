-- 1. استخراج كود الـ Trigger Function (handle_leave_state_machine)
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'handle_leave_state_machine';

-- 2. استخراج كود إجراء الذاتية (process_hr_leave_cut)
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'process_hr_leave_cut';
