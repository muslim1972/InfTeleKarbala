\d work_schedules
\d work_schedule_days
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'profiles' AND column_name LIKE '%schedule%';
