SELECT id, full_name, primary_device_id 
FROM profiles 
WHERE id = 'd2c4eef8-72cc-4dd1-a734-00d5ebe94f6d';

SELECT id, employee_id, check_in, check_out, is_device_pending, notes, raw_punches
FROM attendance_records
WHERE employee_id = 'd2c4eef8-72cc-4dd1-a734-00d5ebe94f6d'
  AND (check_in::date = '2026-10-16' OR created_at::date = '2026-10-16');
