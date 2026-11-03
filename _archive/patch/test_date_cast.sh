#!/bin/bash
docker exec -i $(docker ps --format '{{.Names}}' | grep -m1 db) psql -U postgres -d postgres -c "SELECT ''::date;" 2>&1
