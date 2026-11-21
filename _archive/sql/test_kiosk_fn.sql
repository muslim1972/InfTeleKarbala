SELECT 
    res->>'success' AS success, 
    res->>'device_name' AS device_name,
    jsonb_array_length(res->'employees') AS total_employees,
    (res->'employees'->0)->>'full_name' AS first_emp_name,
    (res->'employees'->0)->'assigned_location_ids' AS first_emp_locs
FROM kiosk_get_employees('KSK-0889B0C3B3') AS res;
