SELECT id, name, parent_id, level 
FROM departments 
WHERE name LIKE '%بيانات%' 
   OR id = '971279d5-f891-4446-af9f-24a89e37eb56' 
   OR id = 'ea9f34ee-b9fa-448a-8837-dbf1bdc20706';
