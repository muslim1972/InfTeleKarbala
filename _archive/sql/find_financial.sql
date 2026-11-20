SELECT id, employee_id, full_name, job_number 
FROM financial_records 
WHERE job_number = '103129538' 
   OR employee_id = 'bf6d0f47-09ee-42ce-b2f8-b8aa0e5bb98f'
   OR full_name LIKE '%صالح%عبد%الحسن%'
   OR full_name LIKE '%صلاح%عبد%الحسن%';
