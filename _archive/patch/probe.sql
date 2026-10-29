SELECT 
  count(*) as total_profiles,
  count(department_id) as with_dept_id,
  count(case when id in (select employee_id from work_location_employees) then 1 end) as with_location,
  count(case when (section_text is not null and section_text != '') or (dept_text is not null and dept_text != '') then 1 end) as with_text,
  count(case when department_id is null 
              and id not in (select employee_id from work_location_employees) 
              and (section_text is null or section_text = '') 
              and (dept_text is null or dept_text = '') then 1 end) as orphans
FROM profiles;
