#!/bin/bash
CONTAINER=$(docker ps -q -f name=db | head -n1)

echo "=== Columns of service_continuity_requests ==="
docker exec -i "$CONTAINER" psql -U postgres -d postgres -c "
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'service_continuity_requests' 
    ORDER BY ordinal_position;
"

echo -e "\n=== Definition of update_and_approve_continuity_by_finance ==="
docker exec -i "$CONTAINER" psql -U postgres -d postgres -c "
    SELECT pg_get_functiondef(oid) 
    FROM pg_proc 
    WHERE proname = 'update_and_approve_continuity_by_finance';
"

echo -e "\n=== Definition of process_service_continuity_supervisor ==="
docker exec -i "$CONTAINER" psql -U postgres -d postgres -c "
    SELECT pg_get_functiondef(oid) 
    FROM pg_proc 
    WHERE proname = 'process_service_continuity_supervisor';
"

echo -e "\n=== Definition of get_service_continuity_request_for_print ==="
docker exec -i "$CONTAINER" psql -U postgres -d postgres -c "
    SELECT pg_get_functiondef(oid) 
    FROM pg_proc 
    WHERE proname = 'get_service_continuity_request_for_print';
"
