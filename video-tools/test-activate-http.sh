#!/bin/bash
# activate test via real Kong path
KEY=$(docker exec supabase-kong env | grep '^SUPABASE_SERVICE_KEY=' | cut -d= -f2-)
JUN=9816a4d0-3ab7-450f-966a-7f0580645ce0
AUG=75f6e11f-eb85-49f0-bada-1593402d09a3
FAKE=00000000-0000-0000-0000-000000000000
URL='http://127.0.0.1:80/rest/v1/rpc/activate_monthly_snapshot'

echo '--- T0: grant EXECUTE to service_role (server-side only) ---'
docker exec supabase-db psql -U supabase_admin -d postgres -c "GRANT EXECUTE ON FUNCTION public.activate_monthly_snapshot(uuid) TO service_role;"

echo '--- T1: fake id, expect business error 400 ---'
curl -sS --max-time 15 -w '\nSTATUS=%{http_code}\n' -X POST "$URL" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' -d "{\"p_snapshot_id\":\"$FAKE\"}"

echo '--- T2: REAL activate June via Kong (the user click) ---'
curl -sS --max-time 15 -w '\nSTATUS=%{http_code}\n' -X POST "$URL" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' -d "{\"p_snapshot_id\":\"$JUN\"}"

echo '--- T3: state after June activation ---'
docker exec supabase-db psql -U supabase_admin -d postgres -tAc "SELECT name, is_active FROM public.monthly_snapshots ORDER BY created_at; SELECT count(*) FROM public.financial_records;"

echo '--- T4: activate August back (restore working state) ---'
curl -sS --max-time 15 -w '\nSTATUS=%{http_code}\n' -X POST "$URL" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' -d "{\"p_snapshot_id\":\"$AUG\"}"

echo '--- T5: final state ---'
docker exec supabase-db psql -U supabase_admin -d postgres -tAc "SELECT name, is_active FROM public.monthly_snapshots ORDER BY created_at; SELECT count(*) FROM public.financial_records;"
