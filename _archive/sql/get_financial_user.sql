SELECT id, user_id, full_name, transport_allowance 
FROM financial_records 
WHERE user_id = 'bf6d0f47-09ee-42ce-b2f8-b8aa0e5bb98f'
   OR full_name LIKE '%صالح%عبد%الحسن%'
   OR full_name LIKE '%صلاح%عبد%الحسن%';
