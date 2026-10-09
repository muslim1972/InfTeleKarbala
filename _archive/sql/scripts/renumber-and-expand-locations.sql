-- ============================================================
-- Renumber complexes as (ikhtiyari 1..8) for non-karbala govs
-- + attendance cards for every independent unit (level >= 3)
-- + rename-trigger fix: strip only "(ein)" suffix, not any parens
-- + insert trigger: new unit -> attendance card automatically
-- + clone_departments_tree: renumber complexes + ensure cards
-- ASCII only; Arabic via E'\uXXXX' escapes (pscp-safe)
-- ============================================================

\echo '=== PRE created_by_col ==='
SELECT is_nullable, column_default FROM information_schema.columns
 WHERE table_name='work_locations' AND column_name='created_by';

\echo '=== PRE wl_counts ==='
SELECT governorate, count(*) FROM work_locations GROUP BY governorate ORDER BY governorate;

BEGIN;

-- ------------------------------------------------------------
-- 1) Fix rename trigger: strip ONLY the "(ein)" honorific suffix
--    (old regex stripped any "(...)" and would corrupt "(ikhtiyari N)")
-- ------------------------------------------------------------
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
    old_base := btrim(regexp_replace(OLD.name, E'\\s*\\(\u0639\\)\\s*$', ''));
    new_base := btrim(regexp_replace(NEW.name, E'\\s*\\(\u0639\\)\\s*$', ''));
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

-- ------------------------------------------------------------
-- 2) Babil: delete duplicate placeholder complex cards (refs = 0, safe)
-- ------------------------------------------------------------
WITH del AS (
    DELETE FROM work_locations
     WHERE governorate = 'babil'
       AND ( name LIKE E'\u0645\u062C\u0645\u0639 \u0627\u062A\u0635\u0627\u0644\u0627\u062A /%'
          OR name LIKE E'\u0645\u062C\u0645\u0639 \u0627\u062A\u0635\u0627\u0644\u0627\u062A/%'
          OR name LIKE E'\u0645\u062C\u0645\u0639 \u0627\u062A\u0635\u0627\u0644\u0627\u062A (%'
          OR name LIKE E'\u0645\u062C\u0645\u0639 \u0627\u062A\u0635\u0627\u0644\u0627\u062A(%' )
    RETURNING id
)
SELECT 'babil_placeholder_cards_deleted' AS tag, count(*) AS deleted FROM del;

-- ------------------------------------------------------------
-- 3) Babil departments: normalize numbering, KEEP existing number
--    "majma itisalat(ikhtiyari N)" -> "majma itisalat (ikhtiyari N)"
-- ------------------------------------------------------------
UPDATE departments
   SET name = E'\u0645\u062C\u0645\u0639 \u0627\u062A\u0635\u0627\u0644\u0627\u062A (\u0627\u062E\u062A\u064A\u0627\u0631\u064A '
              || btrim(substring(name FROM E'\\(\\s*\u0627\u062E\u062A\u064A\u0627\u0631\u064A\\s+([0-9]+)\\s*\\)'))
              || ')',
       updated_at = now()
 WHERE governorate = 'babil'
   AND level = 3
   AND name LIKE E'\u0645\u062C\u0645\u0639 \u0627\u062A\u0635\u0627\u0644\u0627\u062A%'
   AND name LIKE E'%\u0627\u062E\u062A\u064A\u0627\u0631\u064A%';

-- ------------------------------------------------------------
-- 4) Najaf departments: number complexes 1..8 by id order
--    (rename trigger syncs najaf cards automatically)
-- ------------------------------------------------------------
WITH mj AS (
    SELECT id, row_number() OVER (ORDER BY id) AS rn
      FROM departments
     WHERE governorate = 'najaf' AND level = 3
       AND name LIKE E'\u0645\u062C\u0645\u0639 \u0627\u062A\u0635\u0627\u0644\u0627\u062A%'
)
UPDATE departments d
   SET name = E'\u0645\u062C\u0645\u0639 \u0627\u062A\u0635\u0627\u0644\u0627\u062A (\u0627\u062E\u062A\u064A\u0627\u0631\u064A ' || mj.rn || ')',
       updated_at = now()
  FROM mj
 WHERE d.id = mj.id;

-- ------------------------------------------------------------
-- 5) itpc_hq departments: same renumbering (no cards exist -> no side effects)
-- ------------------------------------------------------------
WITH mj AS (
    SELECT id, row_number() OVER (ORDER BY id) AS rn
      FROM departments
     WHERE governorate = 'itpc_hq' AND level = 3
       AND name LIKE E'\u0645\u062C\u0645\u0639 \u0627\u062A\u0635\u0627\u0644\u0627\u062A%'
)
UPDATE departments d
   SET name = E'\u0645\u062C\u0645\u0639 \u0627\u062A\u0635\u0627\u0644\u0627\u062A (\u0627\u062E\u062A\u064A\u0627\u0631\u064A ' || mj.rn || ')',
       updated_at = now()
  FROM mj
 WHERE d.id = mj.id;

-- ------------------------------------------------------------
-- 6) Governorate display names (for card suffixes, same as existing data)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gov_display_name(p_gov text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
    SELECT CASE p_gov
        WHEN 'karbala' THEN E'\u0643\u0631\u0628\u0644\u0627\u0621'
        WHEN 'babil'   THEN E'\u0628\u0627\u0628\u0644'
        WHEN 'najaf'   THEN E'\u0627\u0644\u0646\u062C\u0641'
        ELSE p_gov
    END;
$$;

-- ------------------------------------------------------------
-- 7) ensure_work_locations_for_governorate: create a card for every
--    independent unit (level >= 3) missing one; idempotent
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_work_locations_for_governorate(p_gov text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cnt integer;
BEGIN
    WITH cand AS (
        SELECT d.id,
               d.name AS dname,
               d.governorate AS gov,
               btrim(regexp_replace(d.name, E'\\s*\\(\u0639\\)\\s*$', '')) AS dbase
          FROM departments d
         WHERE d.governorate = p_gov
           AND d.level >= 3
    ),
    ins AS (
        INSERT INTO work_locations (name, latitude, longitude, radius_meters, is_active, governorate)
        SELECT c.dname || '/' || public.gov_display_name(c.gov),
               0, 0, 50, true, c.gov
          FROM cand c
         WHERE NOT EXISTS (
             SELECT 1 FROM work_locations wl
              WHERE wl.governorate = c.gov
                AND ( wl.name = c.dname
                   OR wl.name = c.dbase
                   OR left(wl.name, char_length(c.dbase) + 1) = c.dbase || '/'
                   OR left(wl.name, char_length(c.dbase) + 2) = c.dbase || ' /' )
         )
        RETURNING 1
    )
    SELECT count(*) INTO v_cnt FROM ins;
    RETURN v_cnt;
END;
$$;

-- ------------------------------------------------------------
-- 8) INSERT trigger: any new unit (level >= 3) gets a card automatically
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.on_department_insert_ensure_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.level IS NOT NULL AND NEW.level >= 3 AND NEW.governorate IS NOT NULL THEN
        PERFORM public.ensure_work_locations_for_governorate(NEW.governorate);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dept_insert_ensure_location ON departments;
CREATE TRIGGER trg_dept_insert_ensure_location
AFTER INSERT ON departments
FOR EACH ROW
EXECUTE FUNCTION on_department_insert_ensure_location();

REVOKE ALL ON FUNCTION on_department_insert_ensure_location() FROM PUBLIC;
REVOKE ALL ON FUNCTION ensure_work_locations_for_governorate(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION gov_display_name(text) FROM PUBLIC;

-- ------------------------------------------------------------
-- 9) Backfill cards for the 3 active governorates
--    expected: karbala 26, babil 34, najaf 26
-- ------------------------------------------------------------
SELECT 'backfill_karbala' AS tag, public.ensure_work_locations_for_governorate('karbala') AS created;
SELECT 'backfill_babil'   AS tag, public.ensure_work_locations_for_governorate('babil')   AS created;
SELECT 'backfill_najaf'   AS tag, public.ensure_work_locations_for_governorate('najaf')   AS created;

-- ------------------------------------------------------------
-- 10) clone_departments_tree: renumber complexes of the NEW governorate
--     (no karbala names forced) + ensure its attendance cards
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clone_departments_tree(target_gov text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    rec RECORD;
    existing INT;
BEGIN
    SELECT count(*) INTO existing FROM public.departments WHERE governorate = target_gov;
    IF existing > 0 THEN
        RETURN;
    END IF;

    CREATE TEMP TABLE IF NOT EXISTS dept_mapping (old_id UUID, new_id UUID);
    TRUNCATE TABLE dept_mapping;

    FOR rec IN SELECT id FROM public.departments WHERE governorate = 'karbala' LOOP
        INSERT INTO dept_mapping (old_id, new_id) VALUES (rec.id, gen_random_uuid());
    END LOOP;

    INSERT INTO public.departments (id, name, level, parent_id, manager_id, created_at, updated_at, governorate)
    SELECT
        m.new_id,
        d.name,
        d.level,
        mp.new_id,
        NULL,
        NOW(),
        NOW(),
        target_gov
    FROM public.departments d
    JOIN dept_mapping m ON d.id = m.old_id
    LEFT JOIN dept_mapping mp ON d.parent_id = mp.old_id
    WHERE d.governorate = 'karbala';

    DROP TABLE dept_mapping;

    -- renumber complexes: placeholders until the governorate supervisor renames them
    WITH mj AS (
        SELECT id, row_number() OVER (ORDER BY id) AS rn
          FROM public.departments
         WHERE governorate = target_gov AND level = 3
           AND name LIKE E'\u0645\u062C\u0645\u0639 \u0627\u062A\u0635\u0627\u0644\u0627\u062A%'
    )
    UPDATE public.departments d
       SET name = E'\u0645\u062C\u0645\u0639 \u0627\u062A\u0635\u0627\u0644\u0627\u062A (\u0627\u062E\u062A\u064A\u0627\u0631\u064A ' || mj.rn || ')',
           updated_at = NOW()
      FROM mj
     WHERE d.id = mj.id;

    -- attendance cards for every independent unit
    PERFORM public.ensure_work_locations_for_governorate(target_gov);
END;
$$;

-- ------------------------------------------------------------
-- In-transaction verification
-- ------------------------------------------------------------
\echo '=== VERIFY babil_depts_majma ==='
SELECT id, name FROM departments WHERE governorate='babil' AND level=3 AND name LIKE E'\u0645\u062C\u0645\u0639%' ORDER BY id;

\echo '=== VERIFY najaf_cards_numbered ==='
SELECT name FROM work_locations WHERE governorate='najaf' AND name LIKE E'\u0645\u062C\u0645\u0639 \u0627\u062A\u0635\u0627\u0644\u0627\u062A (\u0627\u062E\u062A\u064A\u0627\u0631\u064A%' ORDER BY name;

\echo '=== VERIFY wl_counts ==='
SELECT governorate, count(*) FROM work_locations GROUP BY governorate ORDER BY governorate;

COMMIT;

-- ------------------------------------------------------------
-- Post-commit confirmation
-- ------------------------------------------------------------
\echo '=== POST triggers ==='
SELECT tgname FROM pg_trigger WHERE tgrelid='departments'::regclass AND NOT tgisinternal;

\echo '=== POST unnumbered_majma_outside_karbala (expect 0 rows) ==='
SELECT governorate, id, name FROM departments
 WHERE governorate <> 'karbala' AND level = 3
   AND name LIKE E'\u0645\u062C\u0645\u0639 \u0627\u062A\u0635\u0627\u0644\u0627\u062A%'
   AND name NOT LIKE E'%\u0627\u062E\u062A\u064A\u0627\u0631\u064A%';
