#!/bin/bash
KEY=$(docker exec supabase-kong env | grep '^SUPABASE_SERVICE_KEY=' | cut -d= -f2-)
echo "KEY_LEN=${#KEY}"
echo '--- A: Kong local 8000, fake id (safe) ---'
curl -s -X POST 'http://127.0.0.1:8000/rest/v1/rpc/activate_monthly_snapshot' \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' \
  -d '{"p_snapshot_id":"00000000-0000-0000-0000-000000000000"}'
echo
echo '--- B: via egov domain (user path), fake id (safe) ---'
curl -sk -X POST 'https://khr-itpc.egov.iq/rest/v1/rpc/activate_monthly_snapshot' \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' \
  -d '{"p_snapshot_id":"00000000-0000-0000-0000-000000000000"}'
echo
echo '--- C: snapshots state after tests ---'
docker exec supabase-db psql -U supabase_admin -d postgres -tAc "SELECT name, is_active FROM public.monthly_snapshots ORDER BY created_at;"
