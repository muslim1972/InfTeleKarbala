#!/bin/bash
cat /tmp/resolve_shift_absence_or_penalty.sql | docker exec -i supabase-db psql -U supabase_admin -d postgres
docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT proname, proargnames FROM pg_proc WHERE proname = 'resolve_shift_absence_or_penalty';"
