-- 1) حقول الصلاحية لمنتسبي القسم وشعبه (عبر department_id)
SELECT p.job_number, p.full_name, p.admin_role,
       (p.has_capacities_access) AS hca
FROM public.profiles p
WHERE p.department_id IN (
    '33333333-2222-2222-2222-222222222222',
    'f7b97974-c251-4eb9-b91f-4143ba08a38c',
    '3d03eb6a-1687-4002-9821-57678a760559')
ORDER BY p.admin_role NULLS LAST, p.full_name;

-- 2) هل profiles فيها عمود has_capacities_access أصلاً؟
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema='public' AND table_name='profiles'
  AND column_name IN ('admin_role','has_capacities_access','department_id');

-- 3) مقارنة: admin_role في نسخة حزيران (أمس) لنفس المنتسبين
SELECT sp.user_id, sp.data->>'job_number' AS job_no,
       sp.data->>'admin_role' AS snap_admin_role,
       sp.data->>'has_capacities_access' AS snap_hca,
       sp.data->>'department_id' AS snap_dept
FROM public.monthly_snapshot_profiles sp
WHERE sp.snapshot_id = (SELECT id FROM public.monthly_snapshots ORDER BY created_at DESC LIMIT 1)
  AND sp.data->>'department_id' IN (
    '33333333-2222-2222-2222-222222222222',
    'f7b97974-c251-4eb9-b91f-4143ba08a38c',
    '3d03eb6a-1687-4002-9821-57678a760559')
ORDER BY 2;

-- 4) مصدر الحقيقة: تعريف get_own_profile
SELECT pg_get_functiondef(oid) AS def
FROM pg_proc WHERE proname = 'get_own_profile';
