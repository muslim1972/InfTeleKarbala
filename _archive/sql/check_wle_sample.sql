-- فحص عينة من work_location_employees
SELECT wle.employee_id, wl.name as loc_name, wle.shift_start, wle.shift_end
FROM work_location_employees wle
JOIN work_locations wl ON wl.id = wle.location_id
LIMIT 5;
