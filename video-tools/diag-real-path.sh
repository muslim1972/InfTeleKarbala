echo '=== 0) curl availability ==='
command -v curl && curl --version | head -n1 || echo 'NO_CURL_ON_HOST'
echo
echo '=== 1) docker containers and ports ==='
docker ps --format '{{.Names}} => {{.Ports}}'
echo
echo '=== 2) listening sockets 80/443/3001/8000 ==='
(ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null) | grep -E ':(80|443|3001|8000|8443)\s' || echo 'no_match'
echo
echo '=== 3) DNS resolve khr-itpc.egov.iq from VPS ==='
getent hosts khr-itpc.egov.iq || echo 'DNS_FAIL'
echo
echo '=== 4) service key ==='
KEY=$(docker exec supabase-kong env | grep '^SUPABASE_SERVICE_KEY=' | cut -d= -f2-)
echo "KEY_LEN=${#KEY}"
echo
echo '=== 5) POST activate fake-id via local Kong 8000 ==='
curl -sS --max-time 10 -w '\nSTATUS=%{http_code}\n' -X POST 'http://127.0.0.1:8000/rest/v1/rpc/activate_monthly_snapshot' \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' \
  -d '{"p_snapshot_id":"00000000-0000-0000-0000-000000000000"}' 2>&1
echo
echo '=== 6) GET snapshots via local Kong (data fingerprint) ==='
curl -sS --max-time 10 'http://127.0.0.1:8000/rest/v1/monthly_snapshots?select=name,is_active' \
  -H "apikey: $KEY" 2>&1 | head -c 500
echo
echo
echo '=== 7) POST activate fake-id via https://khr-itpc.egov.iq (USER PATH) ==='
curl -sSk --max-time 15 -w '\nSTATUS=%{http_code}\n' -X POST 'https://khr-itpc.egov.iq/rest/v1/rpc/activate_monthly_snapshot' \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' \
  -d '{"p_snapshot_id":"00000000-0000-0000-0000-000000000000"}' 2>&1
echo
echo '=== 8) GET snapshots via egov (does VPS key work there?) ==='
curl -sSk --max-time 15 'https://khr-itpc.egov.iq/rest/v1/monthly_snapshots?select=name,is_active' \
  -H "apikey: $KEY" 2>&1 | head -c 500
echo
echo
echo '=== 9) nginx configs mentioning rest/kong/3001 ==='
grep -rn -E 'rest/v1|kong|3001|8000' /etc/nginx/ 2>/dev/null | head -n 30 || echo 'no_nginx_or_no_match'
echo
echo '=== 10) logs: kong/rest/nginx mentioning activate ==='
docker logs supabase-kong --since 48h 2>&1 | grep -i 'activate' | tail -n 15
echo '--- rest container ---'
docker logs supabase-rest --since 48h 2>&1 | grep -i -E 'activate|error' | tail -n 25
echo '--- nginx access ---'
grep -rh -i 'activate' /var/log/nginx/ 2>/dev/null | tail -n 20 || echo 'no_nginx_logs'
echo
echo '=== 11) snapshots state (unchanged check) ==='
docker exec supabase-db psql -U supabase_admin -d postgres -tAc "SELECT name, is_active FROM public.monthly_snapshots ORDER BY created_at;"
