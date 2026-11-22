#!/bin/bash
docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT id, name, level, parent_id FROM departments WHERE governorate = 'karbala' ORDER BY level, name;"
