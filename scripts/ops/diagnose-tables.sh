#!/usr/bin/env bash
set -e

echo "=== 1. SEARCH FOR NIBRAS IN PROFILES ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT id, full_name, role, admin_role, department_id, governorate, work_schedule_id 
FROM profiles 
WHERE full_name ILIKE '%نبراس%' OR full_name ILIKE '%محمود%'
LIMIT 10;
"

echo "=== 2. CHECK ATTENDANCE TABLES IN PUBLIC SCHEMA ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name ILIKE '%attend%';
"

echo "=== 3. CHECK TABLE COLUMNS FOR ATTENDANCE TABLES ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name IN ('attendance', 'attendance_records')
ORDER BY table_name, ordinal_position;
"
