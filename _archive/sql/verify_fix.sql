SELECT count(*) AS dup_loc_count FROM work_locations WHERE id = 'e4047bbe-d928-42b9-a616-b6ccc1522d64';
SELECT count(*) AS real_loc_employees FROM work_location_employees WHERE location_id = '0da575ea-300b-4b24-823d-5478d9ab5f56';
SELECT * FROM kiosk_device_locations WHERE work_location_id = '0da575ea-300b-4b24-823d-5478d9ab5f56';
SELECT action, location_id, actor_name, created_at FROM work_location_audit_logs ORDER BY created_at DESC LIMIT 3;
