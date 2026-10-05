docker exec -i supabase-db psql -U postgres -d postgres -c "
WITH karbala_users AS (
    SELECT id, work_schedule_id FROM profiles WHERE governorate = 'karbala' AND role = 'user'
),
present_today AS (
    SELECT DISTINCT employee_id FROM attendance_records 
    WHERE check_in >= CURRENT_DATE AND check_in < CURRENT_DATE + 1
),
on_leave_today AS (
    SELECT DISTINCT user_id FROM leave_requests 
    WHERE status = 'approved' AND start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE
),
on_rest_today AS (
    SELECT p.id as user_id 
    FROM karbala_users p
    JOIN work_schedule_days wsd ON p.work_schedule_id = wsd.schedule_id
    WHERE wsd.day_of_week = EXTRACT(DOW FROM CURRENT_DATE)::integer AND wsd.is_rest_day = true
)
SELECT 
    (SELECT count(*) FROM karbala_users) as total_users,
    (SELECT count(*) FROM present_today WHERE employee_id IN (SELECT id FROM karbala_users)) as present_count,
    (SELECT count(*) FROM on_leave_today WHERE user_id IN (SELECT id FROM karbala_users)) as leave_count,
    (SELECT count(*) FROM on_rest_today) as rest_count;
"
