docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT p.id, p.full_name, p.governorate, ws.name as schedule_name, ws.type, 
       wsd.day_of_week, wsd.is_rest_day, wsd.is_morning, wsd.is_evening, wsd.is_night
FROM profiles p
JOIN work_schedules ws ON p.work_schedule_id = ws.id
LEFT JOIN work_schedule_days wsd ON ws.id = wsd.schedule_id AND wsd.day_of_week = EXTRACT(DOW FROM CURRENT_DATE)::integer
WHERE p.governorate = 'karbala';
"
