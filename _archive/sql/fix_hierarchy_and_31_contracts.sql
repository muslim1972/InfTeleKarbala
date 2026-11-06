-- 1. تصحيح parent_id الخاص بوحدة البيانات لتتبع شعبة تناقل البيانات IP
UPDATE departments 
SET parent_id = 'ea9f34ee-b9fa-448a-8837-dbf1bdc20706', -- شعبة تناقل البيانات IP
    updated_at = NOW()
WHERE id = '971279d5-f891-4446-af9f-24a89e37eb56'; -- وحدة البيانات

-- التحقق من الربط الجديد لوحدة البيانات
SELECT d.id, d.name, d.level, p.name AS parent_name
FROM departments d
LEFT JOIN departments p ON d.parent_id = p.id
WHERE d.id = '971279d5-f891-4446-af9f-24a89e37eb56';
