SELECT id, status, leave_status, cancellation_status, cut_status, is_deducted 
FROM public.leave_requests 
ORDER BY created_at DESC 
LIMIT 3;
