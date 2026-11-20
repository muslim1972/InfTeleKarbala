-- تصحيح سجل يوم الخميس 2026-11-19
UPDATE attendance_records
SET work_schedule_id = '433a4752-ed73-40b3-922b-5ce05fd12ac5',
    status = 'present',
    check_out = NULL,
    check_out_is_virtual = false,
    check_out_virtual_reason = NULL,
    notes = 'حضور مثبت للشفت (مسائي + خفر ليلي)',
    raw_punches = (
      SELECT jsonb_agg(p)
      FROM jsonb_array_elements(raw_punches) p
      WHERE COALESCE((p->>'is_virtual')::boolean, false) = false
        AND COALESCE(p->>'notes', '') NOT LIKE '%افتراضي%'
    )
WHERE id = '1b7905db-8c15-432f-8c02-1d7039fd63c9';

-- تصحيح سجل يوم الجمعة 2026-11-20 (بصمة انصراف الخفارة الصباحية)
UPDATE attendance_records
SET work_schedule_id = '433a4752-ed73-40b3-922b-5ce05fd12ac5',
    status = 'present',
    check_in = NULL,
    check_out = '2026-11-20 05:20:16.689+00',
    check_out_is_virtual = false,
    notes = 'انصراف خفارة ممتدة (امتداد شفت ليلة الأمس)',
    updated_at = now()
WHERE id = 'f511ce86-1c4a-42f3-a10f-22774b01e73f';

-- فحص النتيجة
SELECT id, check_in, check_out, status, notes, raw_punches 
FROM attendance_records 
WHERE employee_id = '9527573b-5d38-40dc-a616-e25d96eae965'
ORDER BY created_at DESC;
