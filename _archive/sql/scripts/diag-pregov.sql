-- تشخيص قبل migration عزل المحافظات
\echo '=== 1) column types ==='
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name IN ('polls','media_content','poll_questions','poll_options','poll_comments','poll_responses','user_acknowledgments','admin_tips')
  AND column_name IN ('id','poll_id','question_id','content_id','user_id','governorate','created_by','updated_by')
ORDER BY table_name, column_name;

\echo '=== 2) admin_tips rls + policies ==='
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND relname='admin_tips';

SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname='public' AND tablename IN ('admin_tips','poll_responses')
ORDER BY tablename, policyname;

\echo '=== 3) function signatures ==='
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args, p.provolatile, p.prosecdef
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('get_my_governorate','is_admin');

\echo '=== 4) all policies on the 8 tables (pre-state) ==='
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname='public'
  AND tablename IN ('polls','media_content','poll_questions','poll_options','poll_comments','poll_responses','user_acknowledgments','admin_tips')
ORDER BY tablename, policyname;

\echo '=== 5) row counts per governorate ==='
SELECT 'polls' t, governorate, count(*) FROM public.polls GROUP BY 1,2
UNION ALL SELECT 'media_content', governorate, count(*) FROM public.media_content GROUP BY 1,2
UNION ALL SELECT 'admin_tips', governorate, count(*) FROM public.admin_tips GROUP BY 1,2
ORDER BY 1,2;

\echo '=== done ==='
