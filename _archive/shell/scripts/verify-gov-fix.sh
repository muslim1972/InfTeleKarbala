#!/bin/sh
# verify-gov-fix.sh — تحقق نهائي من عزل المحافظات (سياسات DB + بيانات قديمة + حزم JS)
# يُرفع بـ pscp إلى /tmp ويُنفَّذ: sh /tmp/verify-gov-fix.sh

echo "########## A) JS deployment ##########"
cd /home/muslim/inftelekarbala/dist || exit 1

echo "--- A1) index.html entry chunk ---"
grep -o 'assets/index-[A-Za-z0-9_-]*\.js' index.html | sort -u

echo "--- A2) 'governorate required' (useMediaContent -> Dashboard chunk) ---"
grep -l 'governorate required' assets/*.js 2>/dev/null || echo 'NOT FOUND'

echo "--- A3) Arabic guard literal in key writer chunks (UTF-8) ---"
for f in assets/PollCreator-*.js assets/MediaSectionEditor-*.js assets/TipsEditor-*.js assets/SummerTrainingPage-*.js; do
  printf '%s : ' "$f"
  grep -c 'لم يتم تحديد المحافظة' "$f" 2>/dev/null || echo 0
done

echo "--- A4) governorate stamp in PollCreator insert (eq/insert payload) ---"
printf 'PollCreator governorate occurrences: '
grep -o 'governorate' assets/PollCreator-*.js | wc -l

echo "--- A5) TipsMarquee activeGovernorate ---"
printf 'TipsMarquee: '
grep -c 'activeGovernorate\|selectedGovernorate' assets/TipsMarquee-*.js 2>/dev/null || echo 0

echo "########## B) DB: policies ##########"
docker exec -i supabase-db psql -U postgres -v ON_ERROR_STOP=0 <<'SQL' 2>&1
\pset pager off
\echo '--- B1) RLS enabled (must all be t) ---'
SELECT relname, relrowsecurity FROM pg_class
WHERE relnamespace='public'::regnamespace
  AND relname IN ('polls','media_content','admin_tips','poll_questions','poll_options','poll_comments','poll_responses','user_acknowledgments')
ORDER BY 1;

\echo '--- B2) policy count per table ---'
SELECT tablename, count(*) AS policies FROM pg_policies
WHERE schemaname='public'
  AND tablename IN ('polls','media_content','admin_tips','poll_questions','poll_options','poll_comments','poll_responses','user_acknowledgments')
GROUP BY 1 ORDER BY 1;

\echo '--- B3) any OPEN (true) policy left — must be 0 rows ---'
SELECT tablename, policyname, cmd FROM pg_policies
WHERE schemaname='public' AND (qual='true' OR with_check='true');

\echo '--- B4) helper functions ---'
SELECT proname, provolatile FROM pg_proc
WHERE pronamespace='public'::regnamespace AND proname IN ('get_my_governorate','is_admin','poll_in_my_gov','media_in_my_gov')
ORDER BY 1;

\echo '--- B5) DATA: governorate distribution (NULL = صفوف يتيمة غير مرئية!) ---'
SELECT 'polls' AS t, coalesce(governorate,'<NULL>') AS gov, count(*) FROM polls GROUP BY 2
UNION ALL SELECT 'media_content', coalesce(governorate,'<NULL>'), count(*) FROM media_content GROUP BY 2
UNION ALL SELECT 'admin_tips', coalesce(governorate,'<NULL>'), count(*) FROM admin_tips GROUP BY 2
ORDER BY 1,2;

\echo '--- B6) profiles governorate distribution ---'
SELECT coalesce(governorate,'<NULL>') AS gov, count(*) FROM profiles GROUP BY 1 ORDER BY 1;
SQL

echo "########## done ##########"
