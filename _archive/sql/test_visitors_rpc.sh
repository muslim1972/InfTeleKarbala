#!/bin/bash
docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT get_active_visitors_by_range(CURRENT_DATE - 7, CURRENT_DATE, 'karbala');"
