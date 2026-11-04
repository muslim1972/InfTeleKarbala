SELECT 
    ms.name, 
    ms.created_at,
    msf.user_id,
    msf.data->>'full_name' AS full_name,
    msf.data->>'nominal_salary' AS nominal_salary,
    msf.data->>'net_salary' AS net_salary
FROM monthly_snapshots ms
JOIN monthly_snapshot_financials msf ON ms.id = msf.snapshot_id
WHERE ms.id = '7190d11d-229e-4a37-a303-085d2b82ff34'
LIMIT 4;
