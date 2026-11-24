#!/bin/bash
set -e
CONTAINER=$(docker ps -q -f name=db | head -n1)
echo "Executing migrations on DB container: $CONTAINER"

docker exec -i "$CONTAINER" psql -U postgres -d postgres < /tmp/20261124163000_itpc_payments_add_official_book_columns.sql
echo "Migration 1 (itpc payments) executed successfully."

docker exec -i "$CONTAINER" psql -U postgres -d postgres < /tmp/20261124163500_hr01_continuity_salary_toggle_and_print_org.sql
echo "Migration 2 (continuity salary toggle + print org) executed successfully."

docker exec -i "$CONTAINER" psql -U postgres -d postgres -c "
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'itpc' AND table_name = 'payments' 
      AND column_name IN ('official_book_date', 'official_book_description');
"
