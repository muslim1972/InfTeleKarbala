-- محاكاة جلسة رسل (authenticated) تماماً كما يراها PostgREST
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"27bc58c5-89c6-4c41-8597-d73bbbf8951d","role":"authenticated"}';

-- 1) نفس استعلام الواجهة حرفياً
SELECT 'dept_query' AS test, id, parent_id
FROM public.departments
WHERE id = 'f7b97974-c251-4eb9-b91f-4143ba08a38c';

-- 2) ماذا تعيد get_my_admin_role لرسل؟
SELECT 'my_admin_role' AS test, public.get_my_admin_role() AS val;

-- 3) عدد صفوف departments المرئية كله
SELECT 'visible_count' AS test, count(*) AS val FROM public.departments;

ROLLBACK;

-- 4) تعريف get_my_admin_role (مصدر الحقيقة)
SELECT pg_get_functiondef(oid) AS def FROM pg_proc WHERE proname = 'get_my_admin_role';
