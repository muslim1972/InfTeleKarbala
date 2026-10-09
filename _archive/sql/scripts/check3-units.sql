-- Check 3: when were babil names changed + do najaf/itpc_hq have placeholders + which functions touch departments
SELECT 'babil_l3_times' AS tag, left(id::text, 8) AS id8, name, created_at, updated_at
  FROM departments
 WHERE governorate='babil' AND level=3
 ORDER BY updated_at DESC;

SELECT 'najaf_l3' AS tag, id, name
  FROM departments
 WHERE governorate='najaf' AND level=3
 ORDER BY id;

SELECT 'itpc_l3' AS tag, id, name
  FROM departments
 WHERE governorate='itpc_hq' AND level=3
 ORDER BY id;

SELECT 'fn_touches_depts' AS tag, proname,
       pg_get_functiondef(oid) AS def
  FROM pg_proc
 WHERE pronamespace = 'public'::regnamespace
   AND prosrc ILIKE '%departments%';

SELECT 'all_dept_triggers' AS tag, tgname, tgenabled
  FROM pg_trigger
 WHERE tgrelid = 'departments'::regclass;
