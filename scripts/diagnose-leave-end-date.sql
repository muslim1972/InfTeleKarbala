-- ═══════════════════════════════════════════════════════════════════════════
-- تشخيص: ظهور "يوم إجازة معتمدة" أمام 27/8/2026 رغم أن الإجازة ليوم واحد (26/8)
-- الموظف: تجريبي 1 (دوام مناوب ينتهي 8:00 صباح اليوم التالي)
--
-- الفرضية المرجّحة من الكود:
--   نموذج الطلب يحسب end_date = (البداية + عدد الأيام) أي «يوم المباشرة المتوقعة»،
--   فإجازة يوم واحد في 26/8 تُخزَّن بـ end_date = 27/8، وقراءتها كحدّ شامل
--   (inclusive) تُظهر 27/8 إجازةً خطأً.
--
-- نفِّذ الاستعلامات التالية بالترتيب في SQL Editor وأرسل لي نتائجها كاملة.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) جميع طلبات الإجازة المتقاطعة مع 26–27 آب 2026 (الموظف تجريبي 1 وغيره للمقارنة)
SELECT
    lr.id,
    p.full_name                          AS employee,
    lr.leave_type,
    lr.time_off_subtype,
    lr.with_request,
    lr.status,
    lr.days_count,
    lr.time_duration_minutes,
    lr.start_date,
    lr.end_date,
    (lr.end_date - lr.start_date)        AS span_days,
    lr.created_at
FROM leave_requests lr
JOIN profiles p ON p.id = lr.user_id
WHERE lr.start_date <= '2026-08-27'
  AND (lr.end_date IS NULL OR lr.end_date >= '2026-08-26')
ORDER BY p.full_name, lr.start_date;

-- 2) هل توجد طلبات مكررة/توليدية لنفس الموظف حول التاريخين؟ (حتى الملغاة والمؤرشفة)
SELECT
    lr.id,
    lr.leave_type,
    lr.with_request,
    lr.is_mandatory,
    lr.status,
    lr.is_archived,
    lr.start_date,
    lr.end_date,
    lr.reason
FROM leave_requests lr
JOIN profiles p ON p.id = lr.user_id
WHERE p.full_name LIKE '%تجريبي%'
  AND lr.start_date >= '2026-08-20'
ORDER BY lr.start_date, lr.created_at;

-- 3) تعريف دالة RPC كما خُزِّنت فعلياً — للتأكد أنها لا تُعيد حساب end_date
SELECT pg_get_functiondef(p.oid) AS rpc_definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'submit_typed_leave_request';

-- 4) أعمدة التواريخ في الجدول (افتراضيات أو قيود قد تؤثر)
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'leave_requests'
  AND column_name IN ('start_date', 'end_date', 'days_count');

-- 5) (تحقق فرضية الدوام المناوب) سجلات حضور الموظف 26–27 آب
-- ملاحظة: الجدول لا يملك عمود date؛ اليوم يُشتق في التطبيق من check_in
SELECT ar.id, ar.check_in, ar.check_out, ar.notes
FROM attendance_records ar
JOIN profiles p ON p.id = ar.employee_id
WHERE p.full_name LIKE '%تجريبي%'
  AND (ar.check_in)::date BETWEEN '2026-08-26' AND '2026-08-27'
ORDER BY ar.check_in;
