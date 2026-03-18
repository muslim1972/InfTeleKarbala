-- סקריפט מיועד لجلب معلومات هيكل جدول الإجازات والأرصدة
-- يرجى تشغيل هذا السكربت في Supabase - SQL Editor وتزويدي بالنتيجة

SELECT 
    column_name, 
    data_type, 
    column_default, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'leave_requests'
ORDER BY ordinal_position;

-- جلب هيكل الأرصدة أيضاً
SELECT 
    column_name, 
    data_type, 
    column_default, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'leave_balances'
ORDER BY ordinal_position;

-- جلب كود الإجراء المخزن الحالي للتعديل/القطع لنعرف كيف يعمل الآن
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'modify_leave_request';
