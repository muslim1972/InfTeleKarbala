SELECT id, name, latitude, longitude, radius_meters 
FROM work_locations 
WHERE governorate = 'karbala' AND (name LIKE '%معاون%' OR name LIKE '%مكتب%' OR name LIKE '%مقر%');
