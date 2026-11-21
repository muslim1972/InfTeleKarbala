SELECT 
    p.full_name,
    ar.id,
    ar.date,
    ar.check_in,
    ar.check_out,
    ar.status,
    ar.notes,
    ar.raw_punches,
    ar.check_in_snapshot_url,
    ar.check_out_snapshot_url
FROM attendance_records ar
JOIN profiles p ON p.id = ar.employee_id
WHERE p.full_name LIKE '%محمد عبد الرضا%'
ORDER BY ar.date DESC
LIMIT 5;
