BEGIN;

-- 1. تحديث جدول profiles الحي
UPDATE public.profiles 
SET admin_role = NULL 
WHERE id = '16050e0b-e3c0-4efe-b0a3-f667a0f71257' 
  AND admin_role = 'it_supervisor';

-- 2. تحديث جدول monthly_snapshot_profiles في أي نسخة يظهر فيها كمشرف IT
UPDATE public.monthly_snapshot_profiles
SET data = jsonb_set(data, '{admin_role}', 'null'::jsonb)
WHERE user_id = '16050e0b-e3c0-4efe-b0a3-f667a0f71257'
  AND data->>'admin_role' = 'it_supervisor';

COMMIT;

-- التحقق من النتيجة في profiles
SELECT id, full_name, job_number, role, admin_role, governorate 
FROM public.profiles 
WHERE id = '16050e0b-e3c0-4efe-b0a3-f667a0f71257';

-- التحقق في نسخ الأشهر
SELECT 
    ms.name AS snapshot_name,
    msp.data->>'full_name' AS full_name,
    msp.data->>'admin_role' AS admin_role,
    msp.data->>'role' AS role
FROM public.monthly_snapshot_profiles msp
JOIN public.monthly_snapshots ms ON ms.id = msp.snapshot_id
WHERE msp.user_id = '16050e0b-e3c0-4efe-b0a3-f667a0f71257';
