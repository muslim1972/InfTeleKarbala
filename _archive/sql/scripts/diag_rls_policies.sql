\echo '=== policies الجداول ذات الصلة ==='
SELECT tablename, policyname, cmd, roles, qual IS NOT NULL AS has_using, with_check IS NOT NULL AS has_with_check
FROM pg_policies
WHERE tablename IN ('attendance_records','leave_requests','profiles','work_schedules','work_schedule_days')
ORDER BY tablename, cmd;

\echo '=== هل get_server_time متاحة لعامة؟ ==='
SELECT proname, proacl::text FROM pg_proc WHERE proname='get_server_time';

\echo '=== حساب kiosk موجود مسبقاً؟ ==='
SELECT id, email FROM auth.users WHERE email LIKE '%kiosk%';

\echo '=== كيوسكات مسجلة مسبقاً؟ ==='
SELECT to_regclass('public.kiosk_devices');
