#!/bin/bash
docker exec -i $(docker ps --format '{{.Names}}' | grep -m1 db) psql -U postgres -d postgres -c "
SELECT count(*), role, admin_role 
FROM public.profiles 
WHERE role = 'user' AND admin_role IS NOT NULL 
GROUP BY role, admin_role;
"
