#!/usr/bin/env bash
set -e

echo "=== PG_CRON JOBS ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT jobid, schedule, command, active FROM cron.job;"

echo "=== TEST EVALUATE FUNCTION DAYTIME GUARD ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT public.evaluate_morning_shift_daily_attendance();" || echo "Daytime guard successfully blocked execution!"
