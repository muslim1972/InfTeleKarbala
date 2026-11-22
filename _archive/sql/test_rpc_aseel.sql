BEGIN;
SELECT set_config('request.jwt.claim.sub', '8e167547-3ea1-42a8-a6a4-2f3fc15b017a', true);
SELECT set_config('role', 'authenticated', true);
SELECT count(*) FROM public.get_supervised_department_employees('8669731c-bca9-46c5-9def-710e71c6f267');
COMMIT;
