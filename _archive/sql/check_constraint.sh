#!/bin/bash
echo "=== ALL PROFILES GENDER ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT COALESCE(gender, 'unspecified') as g, count(*) FROM profiles GROUP BY g;"

echo "=== KARBALA PROFILES GENDER ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT COALESCE(gender, 'unspecified') as g, count(*) FROM profiles WHERE governorate = 'karbala' GROUP BY g;"

echo "=== BABIL PROFILES GENDER ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT COALESCE(gender, 'unspecified') as g, count(*) FROM profiles WHERE governorate = 'babil' GROUP BY g;"
