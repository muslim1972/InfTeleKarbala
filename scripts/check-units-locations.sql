-- Investigate: current work_locations state + full department tree per governorate
SELECT 'babil_locations_now' AS tag, left(id::text, 8) AS id8, name, is_active, created_at::date AS created, left(coalesce(created_by::text, '-'), 8) AS by8
  FROM work_locations WHERE governorate='babil' ORDER BY created_at;

SELECT 'karbala_locations_cnt' AS tag, count(*) FROM work_locations WHERE governorate='karbala';

SELECT 'babil_dept_levels' AS tag, level, count(*) AS cnt
  FROM departments WHERE governorate='babil' GROUP BY level ORDER BY level;

SELECT 'karbala_dept_levels' AS tag, level, count(*) AS cnt
  FROM departments WHERE governorate='karbala' GROUP BY level ORDER BY level;

SELECT 'babil_tree' AS tag, d.level, coalesce(p.name, '-') AS parent, d.name
  FROM departments d LEFT JOIN departments p ON p.id = d.parent_id
 WHERE d.governorate='babil'
 ORDER BY d.level, parent, d.name;

SELECT 'wl_indexes' AS tag, indexname, indexdef FROM pg_indexes WHERE tablename='work_locations';
