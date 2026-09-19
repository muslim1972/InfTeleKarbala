-- Work locations governorate isolation (ASCII only file)
BEGIN;

ALTER TABLE work_locations ADD COLUMN IF NOT EXISTS governorate text;

UPDATE work_locations SET governorate = 'karbala' WHERE governorate IS NULL;

-- Babil copies: replace Arabic "karbala almuqaddasa" -> "babil", then "karbala" -> "babil"
INSERT INTO work_locations (name, latitude, longitude, radius_meters, is_active, created_by, governorate)
SELECT
  replace(replace(src.name,
    E'\u0643\u0631\u0628\u0644\u0627\u0621\u0627\u0644\u0645\u0642\u062F\u0633\u0629',
    E'\u0628\u0627\u0628\u0644'),
    E'\u0643\u0631\u0628\u0644\u0627\u0621',
    E'\u0628\u0627\u0628\u0644'),
  32.463700, 44.421200,
  src.radius_meters, src.is_active,
  (SELECT p.id FROM profiles p WHERE p.governorate = 'babil'
     AND p.admin_role IN ('general','developer','it_supervisor') LIMIT 1),
  'babil'
FROM work_locations src
WHERE src.governorate = 'karbala'
  AND NOT EXISTS (
    SELECT 1 FROM work_locations d
    WHERE d.governorate = 'babil'
      AND d.name = replace(replace(src.name,
        E'\u0643\u0631\u0628\u0644\u0627\u0621\u0627\u0644\u0645\u0642\u062F\u0633\u0629',
        E'\u0628\u0627\u0628\u0644'),
        E'\u0643\u0631\u0628\u0644\u0627\u0621',
        E'\u0628\u0627\u0628\u0644')
  );

-- Najaf copies: "karbala almuqaddasa" -> "alnajaf alashraf", "karbala" -> "alnajaf"
INSERT INTO work_locations (name, latitude, longitude, radius_meters, is_active, created_by, governorate)
SELECT
  replace(replace(src.name,
    E'\u0643\u0631\u0628\u0644\u0627\u0621\u0627\u0644\u0645\u0642\u062F\u0633\u0629',
    E'\u0627\u0644\u0646\u062C\u0641' || ' ' || E'\u0627\u0644\u0623\u0634\u0631\u0641'),
    E'\u0643\u0631\u0628\u0644\u0627\u0621',
    E'\u0627\u0644\u0646\u062C\u0641'),
  31.989400, 44.334800,
  src.radius_meters, src.is_active,
  (SELECT p.id FROM profiles p WHERE p.governorate = 'najaf'
     AND p.admin_role IN ('general','developer','it_supervisor') LIMIT 1),
  'najaf'
FROM work_locations src
WHERE src.governorate = 'karbala'
  AND NOT EXISTS (
    SELECT 1 FROM work_locations d
    WHERE d.governorate = 'najaf'
      AND d.name = replace(replace(src.name,
        E'\u0643\u0631\u0628\u0644\u0627\u0621\u0627\u0644\u0645\u0642\u062F\u0633\u0629',
        E'\u0627\u0644\u0646\u062C\u0641' || ' ' || E'\u0627\u0644\u0623\u0634\u0631\u0641'),
        E'\u0643\u0631\u0628\u0644\u0627\u0621',
        E'\u0627\u0644\u0646\u062C\u0641')
  );

-- RLS: drop open policies, create governorate-scoped ones (media_content pattern)
DROP POLICY IF EXISTS "Everyone can view active work locations" ON work_locations;
DROP POLICY IF EXISTS "Admins can manage work locations" ON work_locations;
DROP POLICY IF EXISTS work_locations_select_my_gov ON work_locations;
DROP POLICY IF EXISTS work_locations_insert_admin_my_gov ON work_locations;
DROP POLICY IF EXISTS work_locations_update_admin_my_gov ON work_locations;
DROP POLICY IF EXISTS work_locations_delete_admin_my_gov ON work_locations;

CREATE POLICY work_locations_select_my_gov ON work_locations
  FOR SELECT TO authenticated
  USING (governorate = get_my_governorate());

CREATE POLICY work_locations_insert_admin_my_gov ON work_locations
  FOR INSERT TO authenticated
  WITH CHECK (is_admin() AND (governorate = get_my_governorate()));

CREATE POLICY work_locations_update_admin_my_gov ON work_locations
  FOR UPDATE TO authenticated
  USING (governorate = get_my_governorate())
  WITH CHECK (is_admin() AND (governorate = get_my_governorate()));

CREATE POLICY work_locations_delete_admin_my_gov ON work_locations
  FOR DELETE TO authenticated
  USING (is_admin() AND (governorate = get_my_governorate()));

COMMIT;

-- Verification
SELECT governorate, count(*) FROM work_locations GROUP BY 1 ORDER BY 1;
SELECT policyname, cmd, with_check FROM pg_policies WHERE tablename = 'work_locations' ORDER BY policyname;
