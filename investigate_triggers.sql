-- جلب جميع الـ Triggers المرتبطة بجدول الإجازات (leave_requests)
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'leave_requests';

-- للتحقق من وجود أي إجراء مخزن متعلق بالإلغاء
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname ILIKE '%leave%cancel%' OR proname ILIKE '%cancel%leave%';
