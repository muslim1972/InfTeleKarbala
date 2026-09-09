-- اختبار تفعيل حزيران داخل معاملة ثم تراجع (ASCII فقط - بلا نصوص عربية)
\pset pager off
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"27bc58c5-89c6-4c41-8597-d73bbbf8951d","role":"authenticated"}';
SELECT public.activate_monthly_snapshot('9816a4d0-3ab7-450f-966a-7f0580645ce0') AS result;
ROLLBACK;
