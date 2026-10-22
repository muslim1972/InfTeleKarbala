#!/bin/bash
docker exec -i supabase-db psql -U supabase_admin -d postgres << 'EOF'
-- 1. تحديث سجل الحضور ليصبح إجازة إجبارية بالسبب المباشر
UPDATE attendance_records
SET status = 'leave',
    notes = 'تأخير مناوب تجاوز الساعتين في شفت الخفر (184 دقيقة) - إجازة اعتيادية إجبارية (2 يوم)'
WHERE employee_id = 'd2c4eef8-72cc-4dd1-a734-00d5ebe94f6d'
  AND (created_at::date = '2026-10-15' OR check_in::date = '2026-10-15');

-- 2. إلغاء أي إجازة زمنية سابقة لنفس اليوم وتصفيرها
UPDATE leave_requests
SET status = 'canceled',
    leave_status = 'rejected',
    time_duration_minutes = 0
WHERE user_id = 'd2c4eef8-72cc-4dd1-a734-00d5ebe94f6d'
  AND leave_type = 'time_off'
  AND start_date = '2026-10-15';

-- 3. التحقق من السجلات
SELECT id, employee_id, check_in, status, notes FROM attendance_records WHERE employee_id = 'd2c4eef8-72cc-4dd1-a734-00d5ebe94f6d' AND check_in::date = '2026-10-15';

SELECT id, leave_type, time_off_subtype, time_duration_minutes, status, leave_status, is_mandatory, reason, days_count
FROM leave_requests 
WHERE user_id = 'd2c4eef8-72cc-4dd1-a734-00d5ebe94f6d' AND start_date = '2026-10-15';
EOF
