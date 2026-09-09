-- اختبار تفعيل نسخة حزيران داخل معاملة ثم تراجع (محاكاة جلسة authenticated)
\pset pager off
\echo '=== النسخ الحالية ==='
SELECT id, name, is_active, financial_count, profile_count FROM public.monthly_snapshots ORDER BY created_at;

\echo '=== اختبار activate داخل معاملة (سيُتراجع) ==='
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"27bc58c5-89c6-4c41-8597-d73bbbf8951d","role":"authenticated"}';
SELECT public.activate_monthly_snapshot((SELECT id FROM public.monthly_snapshots WHERE name LIKE '%حزيران%' LIMIT 1)) AS result;
ROLLBACK;
