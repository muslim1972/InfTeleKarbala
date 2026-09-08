-- توقيع الدالة
SELECT pg_get_function_arguments(oid) AS args, proname
FROM pg_proc WHERE proname = 'commit_monthly_snapshot';

-- إنشاء نسخة «شهر آب الثامن 2026» من الحالة الحية الحالية
-- (بدون مزامنة المعروضة: النسخة المعروضة تبقى حزيران كما هي، والجديدة تلتقط الحي = آب)
SELECT public.commit_monthly_snapshot(
    'شهر آب الثامن 2026',
    'excel',
    'مسلم عقيل'
) AS new_snapshot_id;

-- النسخ بعد الإنشاء
SELECT name, financial_count, profile_count, is_active, created_at
FROM public.monthly_snapshots ORDER BY created_at DESC;
