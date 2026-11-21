BEGIN;

-- 1. إصلاح سجل علي حسين لفتة (الجمعة 2026-11-20):
-- ضم بصمات منتصف الليل (00:09 و 00:12) إلى مصفوفة البصمات، وإزالة الخروج المبكر الكاذب
UPDATE attendance_records
SET check_out = NULL,
    notes = 'تأخر عن استلام الشفت بمقدار 15 دقيقة',
    status = 'late',
    raw_punches = jsonb_build_array(
      jsonb_build_object(
        'time', '2026-11-20T11:45:56.110Z',
        'location', '32.589629, 44.026890 - قسم تجهيز خدمات المعلوماتية/كربلاء  (دقة: ±20م, هاتف)',
        'device_id', 'هاتف أندرويد (Android 10) [2bac126e093480376633f66a79b1baa4ff93684e62556e95d467586add13439d]',
        'verified_by_biometric', false,
        'notes', 'حضور الشفت المسائي'
      ),
      jsonb_build_object(
        'time', '2026-11-20T21:09:25.093Z',
        'location', '32.589627, 44.026873 - قسم تجهيز خدمات المعلوماتية/كربلاء  (دقة: ±32م, هاتف)',
        'device_id', 'هاتف أندرويد (Android 10) [2bac126e093480376633f66a79b1baa4ff93684e62556e95d467586add13439d]',
        'verified_by_biometric', false,
        'notes', 'إثبات حضور ليلي (شفت الخفر)'
      ),
      jsonb_build_object(
        'time', '2026-11-20T21:12:28.214Z',
        'location', '32.589626, 44.026890 - قسم تجهيز خدمات المعلوماتية/كربلاء  (دقة: ±20م, هاتف)',
        'device_id', 'هاتف أندرويد (Android 10) [2bac126e093480376633f66a79b1baa4ff93684e62556e95d467586add13439d]',
        'verified_by_biometric', false,
        'notes', 'إثبات حضور ليلي (شفت الخفر)'
      )
    ),
    updated_at = now()
WHERE id = '33b40720-6ac9-4c0d-b528-aa8b8deffb84';

-- حذف السجل المشوه المنشطر لعلي حسين في السبت
DELETE FROM attendance_records WHERE id = '2c64c521-593a-4203-9918-988fd043990e';

-- 2. إصلاح سجل محمد عبد الرضا (الجمعة 2026-11-20):
-- ضم بصمات منتصف الليل (00:01 و 00:56) إلى شفت الجمعة وإلغاء الخروج المبكر الكاذب
UPDATE attendance_records
SET check_out = NULL,
    notes = 'تأخر عن استلام الشفت بمقدار 36 دقيقة',
    status = 'late',
    raw_punches = jsonb_build_array(
      jsonb_build_object(
        'time', '2026-11-20T17:36:32.681Z',
        'location', '32.650406, 43.986882 - مجمع اتصالات الحر/كربلاء (دقة: ±21م, هاتف)',
        'device_id', 'هاتف أندرويد (Android 10) [48a6839795793185468c27bdfde116fc582f9f697692515e4260497de2eae7f3]',
        'verified_by_biometric', false,
        'notes', 'حضور شفت الخفر'
      ),
      jsonb_build_object(
        'time', '2026-11-20T17:39:36.553Z',
        'location', '32.650372, 43.986928 - مجمع اتصالات الحر/كربلاء (دقة: ±19م, هاتف)',
        'device_id', 'هاتف أندرويد (Android 10) [48a6839795793185468c27bdfde116fc582f9f697692515e4260497de2eae7f3]',
        'verified_by_biometric', false,
        'notes', 'تأكيد حضور'
      ),
      jsonb_build_object(
        'time', '2026-11-20T21:01:41.144Z',
        'location', '32.650396, 43.986941 - مجمع اتصالات الحر/كربلاء (دقة: ±16م, هاتف)',
        'device_id', 'هاتف أندرويد (Android 10) [48a6839795793185468c27bdfde116fc582f9f697692515e4260497de2eae7f3]',
        'verified_by_biometric', false,
        'notes', 'إثبات حضور ليلي (شفت الخفر)'
      ),
      jsonb_build_object(
        'time', '2026-11-20T21:56:23.283Z',
        'location', '32.650433, 43.986857 - مجمع اتصالات الحر/كربلاء (دقة: ±19م, هاتف)',
        'device_id', 'هاتف أندرويد (Android 10) [48a6839795793185468c27bdfde116fc582f9f697692515e4260497de2eae7f3]',
        'verified_by_biometric', false,
        'notes', 'إثبات حضور ليلي (شفت الخفر)'
      )
    ),
    updated_at = now()
WHERE id = 'f511ce86-1c4a-42f3-a10f-22774b01e73f';

-- حذف السجل المشوه المنشطر لمحمد عبد الرضا في السبت (الذي أظهر دوام في يوم استراحة كاذب)
DELETE FROM attendance_records WHERE id = '92169308-f425-4508-805d-40517b1c326e';

COMMIT;
