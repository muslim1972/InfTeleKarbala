#!/bin/bash
CONTAINER=$(docker ps -q -f name=db | head -n1)
docker exec -i "$CONTAINER" psql -U postgres -d postgres -c "
    SELECT table_name, column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_schema = 'itpc' 
      AND table_name IN ('official_book_records', 'service_suspensions', 'payments')
    ORDER BY table_name, ordinal_position;
"
