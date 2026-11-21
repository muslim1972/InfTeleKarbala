-- تنظيف ملاحظات التأخير الصباحي الخاطئة في يوم السبت (عطلة/استراحة)
UPDATE attendance_records
SET notes = TRIM(BOTH '| ' FROM REGEXP_REPLACE(notes, '\|?\s*تأخير صباحي\s*\([^)]*\)', '', 'g')),
    status = 'present'
WHERE created_at >= '2026-11-20T21:00:00Z'
  AND created_at <= '2026-11-21T21:00:00Z'
  AND notes LIKE '%تأخير صباحي%';

-- التحقق بعد التعديل
SELECT id, employee_id, created_at, status, check_in, notes
FROM attendance_records
WHERE created_at >= '2026-11-20T21:00:00Z' AND created_at <= '2026-11-21T21:00:00Z';
