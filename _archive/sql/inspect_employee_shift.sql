SELECT id, full_name, work_schedule_id, dept_text, section_text, unit_text 
FROM profiles 
WHERE full_name ILIKE '%محمد عبد الرضا%' OR full_name ILIKE '%العكيلي%';

\d work_schedules
SELECT * FROM work_schedules;
