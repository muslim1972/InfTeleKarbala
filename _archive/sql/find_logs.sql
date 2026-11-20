SELECT id, record_id, field_name, old_value, new_value, changed_at, changed_by 
FROM field_change_logs 
WHERE record_id = 'bf6d0f47-09ee-42ce-b2f8-b8aa0e5bb98f' 
   OR old_value LIKE '%صالح%' 
   OR new_value LIKE '%صالح%'
ORDER BY changed_at DESC
LIMIT 20;
