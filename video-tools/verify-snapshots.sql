-- تحقق نهائي من نظام النسخ
\pset pager off
SELECT name, is_active, financial_count, profile_count, source, created_by_name,
       length(name) AS name_len
FROM public.monthly_snapshots;

SELECT proname, pronargs
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace AND proname LIKE '%monthly_snapshot%'
ORDER BY proname;

-- عينة: التأكد من أن data يحفظ id وuser_id والحروف العربية سليمة
SELECT (SELECT data->>'id' FROM public.monthly_snapshot_financials LIMIT 1) AS rec_id_present,
       (SELECT count(*) FROM public.monthly_snapshot_financials) AS fin_rows,
       (SELECT count(*) FROM public.monthly_snapshot_profiles) AS prof_rows;

SELECT has_table_privilege('authenticated', 'public.monthly_snapshots', 'SELECT') AS auth_can_select,
       has_function_privilege('authenticated', 'public.commit_monthly_snapshot(text,text,text,boolean)', 'EXECUTE') AS auth_can_commit,
       has_function_privilege('anon', 'public.commit_monthly_snapshot(text,text,text,boolean)', 'EXECUTE') AS anon_can_commit;
