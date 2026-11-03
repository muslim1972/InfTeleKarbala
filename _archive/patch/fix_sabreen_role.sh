#!/bin/bash
docker exec -i $(docker ps --format '{{.Names}}' | grep -m1 db) psql -U postgres -d postgres -c "
UPDATE public.profiles 
SET admin_role = NULL 
WHERE role = 'user' AND admin_role IS NOT NULL;
"
