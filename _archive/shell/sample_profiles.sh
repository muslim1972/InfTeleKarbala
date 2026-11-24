#!/bin/bash
CONTAINER=$(docker ps -q -f name=db | head -n1)
docker exec -i "$CONTAINER" psql -U postgres -d postgres -c "
    SELECT full_name, dept_text, section_text, unit_text 
    FROM public.profiles 
    WHERE dept_text IS NOT NULL 
    LIMIT 10;
"
