-- 1. التأكد من حالة الطلبات الأخيرة لدراسة الحقول الجديدة
SELECT id, job_number, status, leave_status, cancellation_status, is_deducted, created_at
FROM public.leave_requests
ORDER BY created_at DESC
LIMIT 5;

-- 2. التحقق من صندوق الأسرار لفهم ما إذا كان الترجر يعمل أصلاً
SELECT id, action_type, previous_balance, new_balance, created_at
FROM public.leave_history
ORDER BY created_at DESC
LIMIT 5;

-- 3. التحقق من الرصيد الحالي للموظف صاحب الطلب الأخير
SELECT user_id, remaining_leaves_balance 
FROM public.financial_records
WHERE user_id IN (
    SELECT user_id FROM public.leave_requests ORDER BY created_at DESC LIMIT 1
);
