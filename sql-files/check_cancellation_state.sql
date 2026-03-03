SELECT id, status, leave_status, cancellation_status, modification_type, is_deducted 
FROM public.leave_requests 
WHERE id = '06629170-489b-4188-a314-db8dcecf1945'::uuid OR modification_type = 'canceled'
ORDER BY created_at DESC LIMIT 1;

SELECT * FROM public.leave_history ORDER BY created_at DESC LIMIT 5;
