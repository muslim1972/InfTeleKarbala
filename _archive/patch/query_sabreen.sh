#!/bin/bash
docker exec -i $(docker ps --format '{{.Names}}' | grep -m1 db) psql -U postgres -d postgres -c "
SELECT id, job_number, full_name, role, admin_role, has_capacities_access, can_view_requests 
FROM public.profiles 
WHERE job_number = '103523';
"
