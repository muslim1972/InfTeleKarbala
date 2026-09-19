-- Check 4: itpc_hq names + najaf locations + karbala coords + wl schema + employee refs
SELECT 'itpc_l3' AS tag, id, name
  FROM departments
 WHERE governorate='itpc_hq' AND level=3
 ORDER BY id;

SELECT 'najaf_wl' AS tag, id, name
  FROM work_locations
 WHERE governorate='najaf'
 ORDER BY id;

SELECT 'karbala_wl' AS tag, id, name, latitude, longitude, radius_meters
  FROM work_locations
 WHERE governorate='karbala'
 ORDER BY id;

SELECT 'wl_schema' AS tag, column_name, is_nullable, data_type, column_default
  FROM information_schema.columns
 WHERE table_name='work_locations'
 ORDER BY ordinal_position;

SELECT 'wle_refs' AS tag, wl.governorate, wl.name, count(wle.id) AS refs
  FROM work_locations wl
  LEFT JOIN work_location_employees wle ON wle.location_id = wl.id
 WHERE wl.governorate IN ('babil','najaf')
 GROUP BY wl.governorate, wl.name
 ORDER BY wl.governorate, wl.name;
