#!/bin/bash
echo "=== PROFILES GENDER COLUMN ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'profiles' AND (column_name ILIKE '%gender%' OR column_name ILIKE '%sex%');"

echo "=== GENDER COLUMNS IN ALL TABLES ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE column_name ILIKE '%gender%' OR column_name ILIKE '%sex%';"

echo "=== LOGIN LOGS COLUMNS ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'login_logs' ORDER BY ordinal_position;"

echo "=== SAMPLE GENDER VALUES IN PROFILES ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT gender, count(*) FROM profiles GROUP BY gender;"

echo "=== LOGIN LOGS RECENT SAMPLE ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT login_at, user_id, full_name FROM login_logs ORDER BY login_at DESC LIMIT 5;"
