#!/bin/bash
CONTAINER=$(docker ps -q -f name=db | head -n1)
docker exec -i "$CONTAINER" psql -U postgres -d postgres -c "
    SELECT pg_get_functiondef(oid) 
    FROM pg_proc 
    WHERE proname = 'get_service_continuity_request_for_print';
" > /tmp/get_print_fn.txt
head -n 60 /tmp/get_print_fn.txt
