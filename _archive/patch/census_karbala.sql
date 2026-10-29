SELECT 
  count(*) as total_karbala_profiles,
  -- 1. Priority 1: Has department_id in hierarchy
  count(case when department_id IS NOT NULL then 1 end) as p1_hierarchy_assigned,
  
  -- 2. Priority 2: No department_id, but has biometric location link
  count(case when department_id IS NULL 
              and id IN (SELECT employee_id FROM work_location_employees) then 1 end) as p2_biometric_only,
              
  -- 3. Priority 3: No department_id, No biometric location, but has text in section/dept
  count(case when department_id IS NULL 
              and id NOT IN (SELECT employee_id FROM work_location_employees) 
              and (NULLIF(trim(section_text), '') IS NOT NULL OR NULLIF(trim(dept_text), '') IS NOT NULL) then 1 end) as p3_text_only,
              
  -- 4. Orphan: Has none of the three
  count(case when department_id IS NULL 
              and id NOT IN (SELECT employee_id FROM work_location_employees) 
              and (NULLIF(trim(section_text), '') IS NULL AND NULLIF(trim(dept_text), '') IS NULL) then 1 end) as orphans_none
FROM profiles
WHERE governorate = 'karbala';
