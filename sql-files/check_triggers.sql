SELECT tgname, pg_get_triggerdef(oid) 
FROM pg_trigger 
WHERE tgrelid = 'public.leave_requests'::regclass;

-- وأيضا لنرى حالة الطلب الأخير
SELECT id, status, leave_status, cancellation_status, cut_status, modification_type
FROM public.leave_requests
ORDER BY created_at DESC 
LIMIT 1;
