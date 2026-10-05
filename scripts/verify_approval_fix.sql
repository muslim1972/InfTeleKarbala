\echo '=== default step ==='
SELECT column_default FROM information_schema.columns
WHERE table_name='leave_requests' AND column_name='current_approval_step';
\echo '=== new function contains single-manager guard ==='
SELECT position('v_chain_len > 1' in pg_get_functiondef(oid)) > 0 AS has_guard,
       position('GREATEST' in pg_get_functiondef(oid)) > 0 AS has_legacy0_map
FROM pg_proc WHERE proname='process_leave_approval';
\echo '=== the stuck request f421b774 ==='
SELECT id, current_approval_step, status, leave_status
FROM leave_requests WHERE id='f421b774-ab15-40d7-863b-1e2469019be8';
\echo '=== remaining unread leave_request twins for processed requests ==='
SELECT count(*) AS stale_twins
FROM system_notifications sn
WHERE sn.type='leave_request' AND sn.is_read=false
  AND sn.metadata->>'request_id' IS NOT NULL
  AND EXISTS (SELECT 1 FROM leave_requests lr
              WHERE lr.id=(sn.metadata->>'request_id')::uuid
                AND lr.status IN ('approved','rejected','canceled'));
