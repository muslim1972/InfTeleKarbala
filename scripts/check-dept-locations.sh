#!/bin/bash
# Inspect departments vs work_locations naming (ASCII only)
echo "=== departments (all govs, level<=3) ==="
docker exec -i supabase-db psql -U postgres -c "SELECT governorate, level, name FROM departments WHERE level <= 3 ORDER BY governorate, level, name;"
echo "=== work_locations (all govs) ==="
docker exec -i supabase-db psql -U postgres -c "SELECT governorate, name FROM work_locations ORDER BY governorate, name;"
echo "=== work_locations columns ==="
docker exec -i supabase-db psql -U postgres -t -A -c "SELECT column_name FROM information_schema.columns WHERE table_name='work_locations' ORDER BY ordinal_position;"
echo "=== existing triggers on departments ==="
docker exec -i supabase-db psql -U postgres -t -A -c "SELECT trigger_name, event_manipulation FROM information_schema.triggers WHERE event_object_table='departments';"
