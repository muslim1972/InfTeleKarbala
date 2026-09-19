-- Check 2: clone function def + governorate scope + karbala tree + trigger
SELECT 'clone_fn' AS tag, pg_get_functiondef(p.oid) AS def
  FROM pg_proc p WHERE p.proname = 'clone_departments_tree';

SELECT 'dept_govs' AS tag, governorate, count(*) AS cnt
  FROM departments GROUP BY governorate ORDER BY governorate;

SELECT 'wl_govs' AS tag, governorate, count(*) AS cnt
  FROM work_locations GROUP BY governorate ORDER BY governorate;

SELECT 'karbala_l3' AS tag, id, name
  FROM departments
 WHERE governorate='karbala' AND level=3
 ORDER BY id;

SELECT 'babil_l3' AS tag, id, name
  FROM departments
 WHERE governorate='babil' AND level=3
 ORDER BY id;

SELECT 'triggers' AS tag, tgname
  FROM pg_trigger
 WHERE tgrelid='departments'::regclass AND NOT tgisinternal;
