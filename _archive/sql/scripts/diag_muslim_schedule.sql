\echo '=== مسلم عقول: الجدول والدوام ==='
SELECT p.id, p.full_name, p.work_schedule_id, p.department_id
FROM profiles p WHERE p.full_name LIKE '%مسلم%';

\echo '=== صفوف جدول دوامه (كل الأيام) ==='
SELECT wsd.schedule_id, wsd.day_of_week, wsd.start_time, wsd.end_time, ws.name AS schedule_name
FROM work_schedule_days wsd
JOIN work_schedules ws ON ws.id = wsd.schedule_id
WHERE wsd.schedule_id = (SELECT work_schedule_id FROM profiles WHERE full_name LIKE '%مسلم%' LIMIT 1)
ORDER BY wsd.day_of_week, wsd.start_time;
