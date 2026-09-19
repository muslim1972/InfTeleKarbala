#!/bin/bash
SQL=${1:-/home/muslim/fix-work-locations.sql}
echo "=== Running: $SQL ==="
docker exec -i supabase-db psql -U postgres -v ON_ERROR_STOP=1 < "$SQL"
echo "=== EXIT: $? ==="
echo "=== babil sample ==="
docker exec -i supabase-db psql -U postgres -t -A -c "SELECT name, latitude, longitude, radius_meters FROM work_locations WHERE governorate='babil' ORDER BY name;"
echo "=== najaf sample ==="
docker exec -i supabase-db psql -U postgres -t -A -c "SELECT name, latitude, longitude, radius_meters FROM work_locations WHERE governorate='najaf' ORDER BY name;"
