SELECT snapshot_id, count(*) 
FROM monthly_snapshot_items 
WHERE snapshot_id IN ('7190d11d-229e-4a37-a303-085d2b82ff34', '428df91f-f09c-401e-8c8e-fcf8988300cb')
GROUP BY snapshot_id;
