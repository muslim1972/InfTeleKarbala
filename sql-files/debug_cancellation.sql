-- 1. التأكد من حالة الطلب بعد أن وافق عليه المدير (لماذا تم الخصم بدل الإرجاع؟)
SELECT id, leave_status, cancellation_status, is_deducted, days_count, start_date
FROM public.leave_requests
ORDER BY created_at DESC
LIMIT 1;

-- 2. عرض كود الدالة المسؤولة عن رفع طلب الإلغاء
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'modify_leave_request';
