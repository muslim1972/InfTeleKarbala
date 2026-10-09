-- تشخيص 2: قيم governorate + الدوال الأمنية + سياسات الجداول الفرعية
\echo === governorate values in rows ===
SELECT 'media_content' t, type, coalesce(governorate,'<NULL>') gov FROM media_content
UNION ALL
SELECT 'polls', category, coalesce(governorate,'<NULL>') gov FROM polls;

\echo === function definitions ===
SELECT proname, pg_get_functiondef(oid) FROM pg_proc
WHERE pronamespace='public'::regnamespace AND proname IN ('get_my_governorate','is_admin');

\echo === sub-table policies ===
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname='public'
  AND tablename IN ('poll_questions','poll_options','poll_responses','poll_comments','user_acknowledgments')
ORDER BY tablename, policyname;

\echo === profiles sample (governorate/role distribution) ===
SELECT governorate, role, admin_role, count(*)
FROM profiles GROUP BY governorate, role, admin_role ORDER BY governorate;
