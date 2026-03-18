-- جلب إجراء اعتماد الذاتية للقطع
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'process_hr_leave_cut';

-- جلب إجراء اعتماد المسؤول للطلبات (لنرى كيف يتعامل مع الإلغاء)
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname IN ('process_leave_approval', 'approve_leave_request', 'update_leave_status', 'process_supervisor_approval');
