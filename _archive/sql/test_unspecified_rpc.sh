#!/bin/bash
docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT jsonb_pretty(get_unspecified_gender_profiles('karbala'));" | head -n 30
