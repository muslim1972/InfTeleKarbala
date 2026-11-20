SELECT full_name, username, job_number 
FROM profiles 
WHERE dept_text = 'قسم المالي والاداري' 
  AND section_text = 'شعبة الخدمات الادارية والنقليات'
ORDER BY full_name;
