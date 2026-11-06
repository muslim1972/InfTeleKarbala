SELECT 
    ms.name AS snapshot_name,
    ms.created_at,
    msp.data->>'full_name' AS full_name,
    msp.data->>'admin_role' AS admin_role,
    msp.data->>'role' AS role
FROM monthly_snapshot_profiles msp
JOIN monthly_snapshots ms ON ms.id = msp.snapshot_id
WHERE msp.user_id = '16050e0b-e3c0-4efe-b0a3-f667a0f71257';
