SELECT 
    p.full_name,
    ar.id,
    ar.created_at AT TIME ZONE 'Asia/Baghdad' AS baghdad_time,
    ar.check_in AT TIME ZONE 'Asia/Baghdad' AS check_in_bg,
    ar.check_out AT TIME ZONE 'Asia/Baghdad' AS check_out_bg,
    ar.status,
    ar.notes,
    ar.check_in_snapshot_url,
    ar.check_out_snapshot_url,
    ar.check_in_location,
    ar.check_out_location,
    ar.raw_punches
FROM attendance_records ar
JOIN profiles p ON p.id = ar.employee_id
WHERE p.full_name LIKE '%محمد عبد الرضا%'
ORDER BY ar.created_at DESC
LIMIT 5;
