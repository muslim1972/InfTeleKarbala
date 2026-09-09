-- test-replace.sql | ASCII only | everything rolled back, zero side effects
BEGIN;
SELECT public.commit_monthly_snapshot('tmp-replace-test', 'excel', NULL, false) AS first_commit;
SELECT public.commit_monthly_snapshot('tmp-replace-test', 'excel', NULL, false) AS second_commit;
SELECT count(*) AS dup_count_must_be_1 FROM public.monthly_snapshots WHERE name = 'tmp-replace-test';
ROLLBACK;
