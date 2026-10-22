SELECT dcr.id, dcr.employee_id, p.full_name, p.governorate, dcr.status, dcr.created_at, dcr.old_device_id, dcr.new_device_id 
FROM device_change_requests dcr
JOIN profiles p ON p.id = dcr.employee_id
ORDER BY dcr.created_at DESC
LIMIT 10;
