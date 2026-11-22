BEGIN;
-- معرف مستخدم وهمي ليس مسؤولاً عن هذا القسم
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
SELECT set_config('role', 'authenticated', true);
SELECT count(*) FROM public.get_supervised_department_employees('8669731c-bca9-46c5-9def-710e71c6f267');
COMMIT;
