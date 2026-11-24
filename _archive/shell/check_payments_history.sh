#!/bin/bash
CONTAINER=$(docker ps -q -f name=db | head -n1)
docker exec -i "$CONTAINER" psql -U postgres -d postgres -c "
    SELECT count(*), min(payment_date), max(payment_date) FROM itpc.payments;
    SELECT * FROM itpc.payments ORDER BY id DESC LIMIT 5;
"
