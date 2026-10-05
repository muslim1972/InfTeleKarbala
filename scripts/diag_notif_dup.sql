-- تشخيص تكرار إشعارات الطلبات — يُنفذ على VPS داخل حاوية supabase-db
\echo '=== 1) default current_approval_step ==='
SELECT column_name, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'leave_requests' AND column_name IN ('current_approval_step','approval_chain','supervisor_id','status','leave_status');

\echo '=== 2) pending requests now ==='
SELECT id, user_id, supervisor_id, approval_chain, current_approval_step,
       status, leave_status, modification_type, leave_type, start_date, created_at
FROM leave_requests
WHERE status = 'pending' OR leave_status = 'pending'
ORDER BY created_at DESC LIMIT 30;

\echo '=== 3) requests touched last 10 days (approved/rejected) ==='
SELECT id, user_id, supervisor_id, current_approval_step,
       array_length(approval_chain,1) AS chain_len, approval_chain,
       status, leave_status, modification_type, created_at, updated_at
FROM leave_requests
WHERE updated_at > NOW() - INTERVAL '10 days'
  AND status IN ('approved','rejected','canceled')
ORDER BY updated_at DESC LIMIT 40;

\echo '=== 4) duplicates: same user+type+start submitted more than once ==='
SELECT user_id, leave_type, start_date, count(*) AS c,
       array_agg(id::text) AS ids,
       array_agg(status) AS statuses,
       array_agg(supervisor_id::text) AS sups
FROM leave_requests
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY user_id, leave_type, start_date
HAVING count(*) > 1
ORDER BY c DESC LIMIT 20;

\echo '=== 5) unread leave_request system notifications per recipient ==='
SELECT recipient_id, count(*) AS unread,
       count(*) FILTER (WHERE type = 'leave_request') AS leave_req,
       count(*) FILTER (WHERE type = 'leave_response') AS leave_resp,
       count(*) FILTER (WHERE type NOT IN ('leave_request','leave_response')) AS other
FROM system_notifications
WHERE is_read = false
GROUP BY recipient_id ORDER BY unread DESC LIMIT 15;

\echo '=== 6) definition of process_leave_approval (live) ==='
SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'process_leave_approval';

\echo '=== 7) definition of submit_typed_leave_request (live) ==='
SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'submit_typed_leave_request';
