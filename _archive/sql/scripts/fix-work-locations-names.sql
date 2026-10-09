-- Fix "almuqaddasa" leftover (there is a space between words)
UPDATE work_locations
SET name = replace(name, ' ' || E'\u0627\u0644\u0645\u0642\u062F\u0633\u0629', '')
WHERE governorate = 'babil';

UPDATE work_locations
SET name = replace(name, ' ' || E'\u0627\u0644\u0645\u0642\u062F\u0633\u0629', ' ' || E'\u0627\u0644\u0623\u0634\u0631\u0641')
WHERE governorate = 'najaf';

SELECT governorate, name FROM work_locations WHERE governorate IN ('babil','najaf') ORDER BY governorate, name;
