SELECT wl.id, wl.name, wl.department_id, count(wle.id) as emp_count
  FROM work_locations wl
  LEFT JOIN work_location_employees wle ON wle.location_id = wl.id
 WHERE wl.governorate = 'karbala'
 GROUP BY wl.id, wl.name, wl.department_id
 ORDER BY wl.name;
