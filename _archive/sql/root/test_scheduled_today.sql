docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT 
    p.id, p.full_name, p.job_number,
    ws.name as schedule_name, ws.type as schedule_type,
    wsd.is_rest_day, wsd.is_morning, wsd.is_evening, wsd.is_night
FROM profiles p
JOIN work_schedules ws ON p.work_schedule_id = ws.id
JOIN work_schedule_days wsd ON ws.id = wsd.schedule_id AND wsd.day_of_week = 5
WHERE p.governorate = 'karbala' AND p.role = 'user'
  AND wsd.is_rest_day = false
  AND (wsd.is_morning = true OR wsd.is_evening = true OR wsd.is_night = true);
"
