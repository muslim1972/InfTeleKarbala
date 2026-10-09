\echo '=== دوال إنشاء المستخدمين الحية ==='
SELECT proname, pg_get_functiondef(oid)
FROM pg_proc
WHERE proname ILIKE '%create%user%' OR proname ILIKE '%admin%account%' OR proname ILIKE '%create%account%';

\echo '=== تعريف is_privileged_user الحي ==='
SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'is_privileged_user';

\echo '=== جدول مواقع العمل (البنية) ==='
SELECT table_name, column_name, data_type FROM information_schema.columns
WHERE table_name IN ('work_locations','locations','site_locations')
ORDER BY table_name, ordinal_position;

\echo '=== عينات مواقع العمل ==='
SELECT * FROM work_locations LIMIT 3;

\echo '=== policies حاوية لقطات البصمة ==='
SELECT policyname, cmd, roles FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname ILIKE '%snapshot%';
