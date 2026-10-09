\echo '=== trigger exists ==='
SELECT tgname, tgenabled FROM pg_trigger
WHERE tgrelid = 'leave_requests'::regclass AND tgname = 'trg_cleanup_request_notifications';
\echo '=== stale notifications for processed requests (must be 0) ==='
SELECT count(*) AS stale
FROM system_notifications sn
WHERE sn.is_read = false AND sn.metadata->>'request_id' IS NOT NULL
  AND EXISTS (SELECT 1 FROM leave_requests lr
              WHERE lr.id = (sn.metadata->>'request_id')::uuid
                AND (lr.status IN ('approved','rejected','canceled')
                  OR lr.leave_status IN ('approved','rejected')
                  OR lr.cancellation_status IN ('approved','rejected')
                  OR lr.cut_status IN ('approved','rejected')
                  OR lr.hr_cut_status IN ('approved','rejected')));
\echo '=== still-valid unread notifications for pending requests (kept) ==='
SELECT count(*) AS valid_pending
FROM system_notifications sn
WHERE sn.is_read = false AND sn.metadata->>'request_id' IS NOT NULL
  AND EXISTS (SELECT 1 FROM leave_requests lr
              WHERE lr.id = (sn.metadata->>'request_id')::uuid
                AND lr.status = 'pending' AND lr.leave_status = 'pending'
                AND lr.cancellation_status NOT IN ('approved','rejected')
                AND lr.cut_status NOT IN ('approved','rejected'));
