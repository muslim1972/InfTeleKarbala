DELETE FROM public.system_notifications WHERE metadata->>'request_id' = '05c2c0d5-6e04-4b01-b97c-25189bad49be';
DELETE FROM public.leave_requests WHERE id = '05c2c0d5-6e04-4b01-b97c-25189bad49be';
