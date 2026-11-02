#!/bin/bash
docker exec -i supabase-db psql -U postgres -d postgres -t -A -F "|" -c "SELECT id, full_name, governorate FROM profiles WHERE full_name IS NOT NULL AND trim(full_name) != '';" > /tmp/profiles_dump.txt
echo "Exported $(wc -l < /tmp/profiles_dump.txt) profiles."
