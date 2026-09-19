-- Department rename -> work_locations sync + babil data repair
-- ASCII only file; Arabic via unicode escapes (pscp corrupts Arabic files)
-- Pre-checks
SELECT 'karbala_l3_count' AS tag, count(*) FROM departments WHERE governorate='karbala' AND level=3;
SELECT 'babil_placeholder_count' AS tag, count(*) FROM departments WHERE governorate='babil' AND level=3 AND name LIKE '%(%' AND name LIKE '%)%';
SELECT 'typo_depts' AS tag, count(*) FROM departments WHERE name LIKE '%' || E'\u0627\u062A\u0635\u0644\u0627\u062A' || '%';
SELECT 'typo_locations' AS tag, count(*) FROM work_locations WHERE name LIKE '%' || E'\u0627\u062A\u0635\u0644\u0627\u062A' || '%';

BEGIN;

-- 1) Fix typo (missing alef: itisalat -> itisalat-correct) in both tables
UPDATE departments
   SET name = replace(name, E'\u0627\u062A\u0635\u0644\u0627\u062A', E'\u0627\u062A\u0635\u0627\u0644\u0627\u062A')
 WHERE name LIKE '%' || E'\u0627\u062A\u0635\u0644\u0627\u062A' || '%';

UPDATE work_locations
   SET name = replace(name, E'\u0627\u062A\u0635\u0644\u0627\u062A', E'\u0627\u062A\u0635\u0627\u0644\u0627\u062A')
 WHERE name LIKE '%' || E'\u0627\u062A\u0635\u0644\u0627\u062A' || '%';

-- 2) Fill babil placeholder complexes from karbala level-3 names (same tree position, by id order)
WITH ph AS (
    SELECT id, row_number() OVER (ORDER BY id) AS rn
      FROM departments
     WHERE governorate = 'babil' AND level = 3
       AND name LIKE '%(%' AND name LIKE '%)%'
),
k AS (
    SELECT name, row_number() OVER (ORDER BY id) AS rn
      FROM departments
     WHERE governorate = 'karbala' AND level = 3
       AND name LIKE E'\u0645\u062C\u0645\u0639%'
)
UPDATE departments d
   SET name = k.name, updated_at = now()
  FROM ph
  JOIN k ON k.rn = ph.rn
 WHERE d.id = ph.id;

-- 3) Trigger: propagate department rename to work_locations (same governorate)
CREATE OR REPLACE FUNCTION sync_work_locations_on_department_rename()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    old_base text;
    new_base text;
BEGIN
    IF NEW.name IS NOT DISTINCT FROM OLD.name THEN
        RETURN NEW;
    END IF;
    old_base := btrim(regexp_replace(OLD.name, E'\\s*\\([^)]*\\)\\s*$', ''));
    new_base := btrim(regexp_replace(NEW.name, E'\\s*\\([^)]*\\)\\s*$', ''));
    IF old_base IS NULL OR old_base = '' THEN
        RETURN NEW;
    END IF;
    UPDATE work_locations wl
       SET name = CASE
               WHEN wl.name = OLD.name
                 OR left(wl.name, char_length(OLD.name) + 1) = OLD.name || '/'
                 OR left(wl.name, char_length(OLD.name) + 2) = OLD.name || ' /'
               THEN NEW.name || substring(wl.name from char_length(OLD.name) + 1)
               ELSE new_base || substring(wl.name from char_length(old_base) + 1)
           END,
           updated_at = now()
     WHERE wl.governorate = NEW.governorate
       AND ( wl.name = OLD.name
          OR left(wl.name, char_length(OLD.name) + 1) = OLD.name || '/'
          OR left(wl.name, char_length(OLD.name) + 2) = OLD.name || ' /'
          OR wl.name = old_base
          OR left(wl.name, char_length(old_base) + 1) = old_base || '/'
          OR left(wl.name, char_length(old_base) + 2) = old_base || ' /' );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dept_rename_sync_work_locations ON departments;
CREATE TRIGGER trg_dept_rename_sync_work_locations
AFTER UPDATE OF name ON departments
FOR EACH ROW
EXECUTE FUNCTION sync_work_locations_on_department_rename();

REVOKE ALL ON FUNCTION sync_work_locations_on_department_rename() FROM PUBLIC;

-- In-transaction verification
SELECT 'babil_level3' AS tag, id, name FROM departments WHERE governorate='babil' AND level=3 ORDER BY id;
SELECT 'babil_locations' AS tag, name FROM work_locations WHERE governorate='babil' ORDER BY name;

COMMIT;

-- Post-commit confirmation
SELECT 'trigger_ok' AS tag, tgname FROM pg_trigger WHERE tgrelid='departments'::regclass AND NOT tgisinternal;
SELECT 'typo_left_depts' AS tag, count(*) FROM departments WHERE name LIKE '%' || E'\u0627\u062A\u0635\u0644\u0627\u062A' || '%';
