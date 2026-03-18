-- 1. هيكل جدول طلبات الإجازات (أهم الأعمدة)
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'leave_requests' 
ORDER BY ordinal_position;

-- 2. الإجراءات المخزنة المتعلقة بالقطع والموافقة
SELECT proname, pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname IN ('process_hr_leave_cut')
   OR proname ILIKE '%leave_approval%'
   OR proname ILIKE '%leave%cancel%'
   OR proname ILIKE '%leave%balance%';

-- 3. المشغلات (Triggers) على جدول الإجازات لمعرفة ما يحدث عند الإلغاء
SELECT trigger_name, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'leave_requests';
