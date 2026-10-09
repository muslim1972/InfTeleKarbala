-- Test: supervisor renames babil complex 1 -> real name; card must follow.
-- Transactional: ROLLBACK at the end, no data change.
\echo '=== T1 before ==='
SELECT name FROM work_locations WHERE governorate='babil' AND name LIKE E'\u0645\u062C\u0645\u0639 \u0627\u062A\u0635\u0627\u0644\u0627\u062A (%' ORDER BY name;

BEGIN;

UPDATE departments
   SET name = E'\u0645\u062C\u0645\u0639 \u0627\u062A\u0635\u0627\u0644\u0627\u062A \u0627\u0628\u0648 \u063A\u0631\u0642'
 WHERE governorate='babil' AND level=3
   AND name = E'\u0645\u062C\u0645\u0639 \u0627\u062A\u0635\u0627\u0644\u0627\u062A (\u0627\u062E\u062A\u064A\u0627\u0631\u064A 1)';

\echo '=== T2 dept renamed ==='
SELECT name FROM departments WHERE governorate='babil' AND level=3 AND id='35d96736-2b64-4927-8ce9-1e4fa371f98e';

\echo '=== T3 synced card (expect abu-gharq card, exactly 1) ==='
SELECT name FROM work_locations WHERE governorate='babil' AND name LIKE E'\u0645\u062C\u0645\u0639 \u0627\u062A\u0635\u0627\u0644\u0627\u062A \u0627\u0628\u0648 \u063A\u0631\u0642%';

\echo '=== T4 other numbered cards untouched (expect 7) ==='
SELECT count(*) FROM work_locations WHERE governorate='babil' AND name LIKE E'\u0645\u062C\u0645\u0639 \u0627\u062A\u0635\u0627\u0644\u0627\u062A (\u0627\u062E\u062A\u064A\u0627\u0631\u064A%';

ROLLBACK;

\echo '=== T5 after rollback (state intact, expect 8 numbered, 0 abu-gharq) ==='
SELECT count(*) AS numbered FROM work_locations WHERE governorate='babil' AND name LIKE E'\u0645\u062C\u0645\u0639 \u0627\u062A\u0635\u0627\u0644\u0627\u062A (\u0627\u062E\u062A\u064A\u0627\u0631\u064A%';
SELECT count(*) AS abu_gharq FROM work_locations WHERE governorate='babil' AND name LIKE E'\u0645\u062C\u0645\u0639 \u0627\u062A\u0635\u0627\u0644\u0627\u062A \u0627\u0628\u0648 \u063A\u0631\u0642%';
