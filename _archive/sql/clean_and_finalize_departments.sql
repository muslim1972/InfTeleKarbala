BEGIN;

-- 1. Create work location for "مكتب معاون مدير المديرية"
INSERT INTO work_locations (name, department_id, governorate, is_active, latitude, longitude, radius_meters)
VALUES ('مكتب معاون مدير المديرية/كربلاء', '22222222-2222-2222-2222-222222222222', 'karbala', true, 32.616, 44.025, 50)
ON CONFLICT DO NOTHING;

-- 2. Move the 8 employees of "مكتب معاون مدير المديرية" to the new location
UPDATE work_location_employees
   SET location_id = (SELECT id FROM work_locations WHERE department_id = '22222222-2222-2222-2222-222222222222' LIMIT 1)
 WHERE employee_id IN (
     SELECT id FROM profiles WHERE department_id = '22222222-2222-2222-2222-222222222222'
 );

-- 3. Match and link the remaining HQ employees to their real departments based on their texts
-- Priority 1: section_text
UPDATE profiles p
   SET department_id = d.id
  FROM departments d
 WHERE p.department_id IS NULL
   AND (d.governorate = 'karbala' OR d.governorate = 'كربلاء المقدسة')
   AND (
       d.name = p.section_text
    OR replace(replace(replace(d.name, ' ', ''), 'أ', 'ا'), 'إ', 'ا') = replace(replace(replace(p.section_text, ' ', ''), 'أ', 'ا'), 'إ', 'ا')
   )
   AND p.section_text IS NOT NULL 
   AND p.section_text <> '';

-- Priority 2: unit_text
UPDATE profiles p
   SET department_id = d.id
  FROM departments d
 WHERE p.department_id IS NULL
   AND (d.governorate = 'karbala' OR d.governorate = 'كربلاء المقدسة')
   AND (
       d.name = p.unit_text
    OR replace(replace(replace(d.name, ' ', ''), 'أ', 'ا'), 'إ', 'ا') = replace(replace(replace(p.unit_text, ' ', ''), 'أ', 'ا'), 'إ', 'ا')
   )
   AND p.unit_text IS NOT NULL 
   AND p.unit_text <> '';

-- Priority 3: dept_text
UPDATE profiles p
   SET department_id = d.id
  FROM departments d
 WHERE p.department_id IS NULL
   AND (d.governorate = 'karbala' OR d.governorate = 'كربلاء المقدسة')
   AND (
       d.name = p.dept_text
    OR replace(replace(replace(d.name, ' ', ''), 'أ', 'ا'), 'إ', 'ا') = replace(replace(replace(p.dept_text, ' ', ''), 'أ', 'ا'), 'إ', 'ا')
   )
   AND p.dept_text IS NOT NULL 
   AND p.dept_text <> '';

-- Specific fix for office of director (ابراهيم سعدي سلمان الكعبي)
UPDATE profiles
   SET department_id = '44444444-1111-1111-1111-111111111111'
 WHERE full_name LIKE '%ابراهيم سعدي%';

-- 4. Move all employees to their respective work locations based on their newly set department_id
UPDATE work_location_employees wle
   SET location_id = wl.id
  FROM profiles p
  JOIN work_locations wl ON wl.department_id = p.department_id
 WHERE wle.employee_id = p.id
   AND wle.location_id <> wl.id;

-- 5. Delete the rogue/catch-all "مقر مديرية اتصالات  ومعلوماتية كربلاء المقدسة" location
DELETE FROM work_location_employees
 WHERE location_id = (SELECT id FROM work_locations WHERE name LIKE 'مقر مديرية%' AND governorate = 'karbala');

DELETE FROM work_locations
 WHERE name LIKE 'مقر مديرية%' 
   AND governorate = 'karbala';

COMMIT;

-- Verify: Count of employees in each location in Karbala
SELECT wl.name, count(wle.id) as emp_count
  FROM work_locations wl
  LEFT JOIN work_location_employees wle ON wle.location_id = wl.id
 WHERE wl.governorate = 'karbala'
 GROUP BY wl.name
 ORDER BY emp_count DESC, wl.name;
