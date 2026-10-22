SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'leave_requests'
  AND trigger_name LIKE '%state%';
