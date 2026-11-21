SELECT id, user_id, leave_type, start_date, end_date, days_count, is_mandatory, reason, status
FROM leave_requests
WHERE user_id IN ('a60ccbd2-1131-4ff0-8849-ab87fd9584b6', '9527573b-5d38-40dc-a616-e25d96eae965')
AND start_date >= '2026-11-19';
