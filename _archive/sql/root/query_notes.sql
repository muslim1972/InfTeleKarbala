SELECT ar.id, p.username, p.full_name, ar.check_in, ar.check_out, ar.notes 
FROM attendance_records ar 
JOIN profiles p ON ar.employee_id = p.id 
WHERE p.username LIKE '%test%' 
ORDER BY ar.created_at DESC 
LIMIT 10;
