SELECT p.id, p.full_name, p.department_id, p.work_schedule_id, p.governorate, ws.name, ws.type, ws.start_time, ws.end_time, ws.is_default
FROM profiles p
LEFT JOIN work_schedules ws ON ws.id = p.work_schedule_id
WHERE p.full_name LIKE '%رنا ليث%';

SELECT id, name, type, start_time, end_time, is_default, weekend_days 
FROM work_schedules 
WHERE is_default = true;
