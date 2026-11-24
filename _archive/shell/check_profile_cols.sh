#!/bin/bash
CONTAINER=$(docker ps -q -f name=db | head -n1)
docker exec -i "$CONTAINER" psql -U postgres -d postgres -c "
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'profiles' 
      AND (column_name LIKE '%dept%' OR column_name LIKE '%sec%' OR column_name LIKE '%unit%' OR column_name LIKE '%work%' OR column_name LIKE '%loc%' OR column_name LIKE '%org%')
    ORDER BY ordinal_position;
"
