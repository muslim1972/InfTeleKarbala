#!/bin/bash
docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT id, full_name, dept_text, section_text, unit_text FROM profiles WHERE full_name IS NOT NULL LIMIT 5;"
