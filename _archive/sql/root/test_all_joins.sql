docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT 
    p.id, p.full_name, p.work_schedule_id,
    ws.name as schedule_name, ws.type as schedule_type,
    wsd.is_rest_day, wsd.is_morning, wsd.is_evening, wsd.is_night
FROM profiles p
LEFT JOIN work_schedules ws ON p.work_schedule_id = ws.id
LEFT JOIN work_schedule_days wsd ON ws.id = wsd.schedule_id AND wsd.day_of_week = 5
WHERE p.governorate = 'karbala' AND p.role = 'user';
"
