\echo '=== صفوف دوامه مباشرة بلا انضمام ==='
SELECT * FROM work_schedule_days
WHERE schedule_id = 'dfde4ad5-b343-4a62-9dcd-5efdee625f2b'
ORDER BY day_of_week, start_time;

\echo '=== كل صفوف الدوام التي تبدأ 14:30 (أي جدول) ==='
SELECT 'wsd' AS src, schedule_id, day_of_week, start_time::text, end_time::text
FROM work_schedule_days WHERE start_time::text LIKE '14:3%'
UNION ALL
SELECT 'wsd_end08', schedule_id, day_of_week, start_time::text, end_time::text
FROM work_schedule_days WHERE end_time::text LIKE '08:0%'
ORDER BY 2,3,4;

\echo '=== بنية الجداول ذات الصلة ==='
SELECT table_name FROM information_schema.tables
WHERE table_name LIKE '%schedule%' OR table_name LIKE '%shift%';
