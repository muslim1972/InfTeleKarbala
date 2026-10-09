#!/bin/bash
export PGPASSWORD='mu@ITPC@2026'
psql -h localhost -U postgres -d postgres -f /tmp/query_notes.sql 2>&1
if [ $? -ne 0 ]; then
  echo "Trying docker..."
  echo 'mu@ITPC@2026' | sudo -S docker exec -i $(docker ps -q -f name=db) psql -U postgres -d postgres < /tmp/query_notes.sql 2>&1
fi
