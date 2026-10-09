#!/bin/sh
# تمرير سكربت SQL إلى حاوية Postgres عبر stdin
# usage: run-sql.sh /tmp/file.sql
docker exec -i supabase-db psql -U postgres -v ON_ERROR_STOP=0 < "$1" 2>&1
