-- 1. The 4 in Priority 2 (Biometric location but no department_id)
SELECT 
  p.job_number,
  p.full_name,
  wl.name as biometric_location,
  p.section_text,
  p.dept_text
FROM profiles p
JOIN work_location_employees wle ON wle.employee_id = p.id
JOIN work_locations wl ON wl.id = wle.location_id
WHERE p.department_id IS NULL AND p.governorate = 'karbala';

-- 2. The 1 in Priority 3 (Text only, no department_id, no biometric location)
SELECT 
  p.job_number,
  p.full_name,
  p.section_text,
  p.dept_text
FROM profiles p
WHERE p.department_id IS NULL 
  AND p.id NOT IN (SELECT employee_id FROM work_location_employees)
  AND (NULLIF(trim(p.section_text), '') IS NOT NULL OR NULLIF(trim(p.dept_text), '') IS NOT NULL)
  AND p.governorate = 'karbala';
