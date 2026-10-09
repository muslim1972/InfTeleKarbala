-- تشخيص جداول الاعلام (polls / media_content): الأعمدة، RLS، السياسات، الصفوف
\echo === polls columns ===
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema='public' AND table_name='polls'
ORDER BY ordinal_position;

\echo === media_content columns ===
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema='public' AND table_name='media_content'
ORDER BY ordinal_position;

\echo === RLS enabled? ===
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('polls','media_content','poll_questions','poll_options','poll_responses','poll_comments','user_acknowledgments');

\echo === policies (polls / media_content) ===
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname='public' AND tablename IN ('polls','media_content')
ORDER BY tablename, policyname;

\echo === helper functions existing? ===
SELECT proname, prosecdef
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('get_my_governorate','is_developer','is_admin','get_own_profile','is_it_supervisor');

\echo === counts ===
SELECT 'polls' t, count(*) FROM polls
UNION ALL SELECT 'media_content', count(*) FROM media_content;

\echo === media_content rows ===
SELECT id, type, left(coalesce(title,''),40) AS title, left(coalesce(content,''),35) AS content, is_active
FROM media_content ORDER BY type;

\echo === polls rows (latest 10) ===
SELECT id, category, left(title,45) AS title, is_active, is_deleted, created_at::date
FROM polls ORDER BY created_at DESC LIMIT 10;
