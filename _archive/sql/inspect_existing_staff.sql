SELECT 
    p.job_number,
    p.full_name,
    p.dept_text,
    p.section_text,
    p.unit_text,
    d.name AS dept_name
FROM profiles p
JOIN departments d ON p.department_id = d.id
WHERE (p.job_number NOT LIKE '9999%' OR p.job_number IS NULL)
  AND (d.name LIKE '%شعبة القدرة%' OR d.name LIKE '%الهندية%' OR d.name LIKE '%المباني%')
LIMIT 10;
