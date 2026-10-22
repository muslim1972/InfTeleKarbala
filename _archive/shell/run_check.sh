#!/bin/bash
CONTAINER=$(docker ps --format '{{.Names}}' | grep -m1 db)
docker exec -i "$CONTAINER" psql -U postgres -d postgres < "$1"
