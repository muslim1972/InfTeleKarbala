SELECT p.polname, r.rolname 
FROM pg_policy p 
LEFT JOIN pg_roles r ON r.oid = ANY(p.polroles) 
WHERE p.polname LIKE '%Attendance Snapshots%';
