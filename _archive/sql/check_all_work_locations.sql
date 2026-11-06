-- فحص مواقع العمل في كربلاء
SELECT id, name, department_id, is_active, latitude, longitude
FROM work_locations
WHERE governorate = 'karbala' OR governorate IS NULL
ORDER BY name;
