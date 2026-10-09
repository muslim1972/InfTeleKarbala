-- اختبار وظيفي كامل لسلسلة الكيوسك (v2 — الرمز يُجلب بصلاحية postgres ثم تُحاكى الجلسات)
BEGIN;

-- 1) جلسة أدمن مميز: إنشاء جهاز كيوسك
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub":"2a24e7bf-357a-4587-9461-8289dfe802dc","role":"authenticated"}';
\echo '=== admin_create_kiosk_device ==='
SELECT public.admin_create_kiosk_device('كيوسك تجربة (حذف لاحقاً)', (SELECT id FROM work_locations LIMIT 1));

-- 2) جلب الرمز بصلاحية postgres للاختبار
RESET role;
SELECT activation_code AS kcode FROM kiosk_devices WHERE name LIKE 'كيوسك تجربة%' ORDER BY created_at DESC LIMIT 1 \gset

-- 3) جلسة كيوسك: تفعيل بالرمز الصحيح
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub":"c9fdbd6c-f018-438a-9f66-72b322ab9c9f","role":"authenticated"}';
\echo '=== kiosk_activate بالرمز الصحيح (يجب true + بيانات الموقع) ==='
SELECT public.kiosk_activate(:'kcode');

\echo '=== kiosk_get_employees (عدد المسجلين بالوجه) ==='
SELECT r->>'success' AS ok, jsonb_array_length(r->'employees') AS employees_count,
       r->'employees'->0->>'full_name' AS first_employee,
       r->'employees'->0->'face_descriptor'->0 IS NOT NULL AS has_descriptor
FROM (SELECT public.kiosk_get_employees(:'kcode') AS r) t;

\echo '=== جلسة موظف عادي تحاول RPC الكيوسك (يجب أن ترفض) ==='
SET LOCAL request.jwt.claims = '{"sub":"df58aad4-992c-45f0-93af-0d1f2b35c3f6","role":"authenticated"}';
SELECT public.kiosk_activate(:'kcode') AS should_be_false;

ROLLBACK;
