SELECT id, full_name, email FROM profiles WHERE full_name LIKE '%علي حسين%' OR full_name LIKE '%محمد عبد الرضا%';

SELECT id, employee_id, date, check_in, check_out, raw_punches, total_hours, status, notes
FROM attendance_records
WHERE date IN ('2026-11-20', '2026-11-21')
AND employee_id IN (
    SELECT id FROM profiles WHERE full_name LIKE '%علي حسين%' OR full_name LIKE '%محمد عبد الرضا%'
)
ORDER BY employee_id, date;

SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'closeout_prev_day_attendance';
