-- Preview how the remaining HQ employees will map to real departments
SELECT 
    p.full_name,
    p.dept_text,
    p.section_text,
    p.unit_text,
    d.name as target_dept_name,
    d.id as target_dept_id
FROM profiles p
LEFT JOIN departments d 
  ON (d.governorate = 'karbala' OR d.governorate = 'كربلاء المقدسة')
 AND (
     d.name = p.unit_text
  OR d.name = p.section_text
  OR d.name = p.dept_text
  OR replace(replace(replace(d.name, ' ', ''), 'أ', 'ا'), 'إ', 'ا') = replace(replace(replace(p.section_text, ' ', ''), 'أ', 'ا'), 'إ', 'ا')
  OR replace(replace(replace(d.name, ' ', ''), 'أ', 'ا'), 'إ', 'ا') = replace(replace(replace(p.unit_text, ' ', ''), 'أ', 'ا'), 'إ', 'ا')
  OR replace(replace(replace(d.name, ' ', ''), 'أ', 'ا'), 'إ', 'ا') = replace(replace(replace(p.dept_text, ' ', ''), 'أ', 'ا'), 'إ', 'ا')
 )
WHERE p.id IN (
    SELECT wle.employee_id 
      FROM work_location_employees wle
      JOIN work_locations wl ON wl.id = wle.location_id
     WHERE wl.name LIKE 'مقر مديرية%'
)
AND p.department_id IS NULL
ORDER BY target_dept_name, p.full_name;
