SELECT 
  role,
  governorate,
  count(*) as cnt,
  count(job_number) as with_job_no,
  count(case when full_name is not null and full_name != '' then 1 end) as with_name
FROM profiles
WHERE department_id IS NULL 
  AND id NOT IN (SELECT employee_id FROM work_location_employees) 
  AND (section_text IS NULL OR section_text = '') 
  AND (dept_text IS NULL OR dept_text = '')
GROUP BY role, governorate
ORDER BY cnt DESC;
