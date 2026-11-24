#!/bin/bash
CONTAINER=$(docker ps -q -f name=db | head -n1)
docker exec -i "$CONTAINER" psql -U postgres -d postgres -c "
    SELECT pg_get_functiondef(oid) 
    FROM pg_proc 
    WHERE proname = 'submit_service_continuity_request';
" > /tmp/submit_def.txt
head -n 65 /tmp/submit_def.txt
