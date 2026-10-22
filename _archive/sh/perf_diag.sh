#!/bin/bash
# Test search RPC performance
curl -o /dev/null -s -w 'CODE: %{http_code}\nTIME: %{time_total}s\nSIZE: %{size_download} bytes\n' \
  'http://127.0.0.1:80/rest/v1/rpc/search_available_profiles' \
  -X POST \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg0MjUzNTAxLCJleHAiOjIwOTk2MTM1MDF9.J6epEjJZoyDL5GM_PNLoh3P2j18CCP4WeLrfAejCaew" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg0MjUzNTAxLCJleHAiOjIwOTk2MTM1MDF9.J6epEjJZoyDL5GM_PNLoh3P2j18CCP4WeLrfAejCaew" \
  -d '{"search_term":"مسل","limit_count":20}'

echo ""
echo "=== Test index.html ==="
curl -o /dev/null -s -w 'CODE: %{http_code}\nTIME: %{time_total}s\n' http://127.0.0.1:3001/index.html

echo ""
echo "=== Test main JS chunk ==="
CHUNK=$(grep -oP 'src="/assets/index-[^"]+\.js' /home/muslim/inftelekarbala/dist/index.html | head -1 | sed 's|src="/||')
curl -o /dev/null -s -w "CODE: %{http_code}\nTIME: %{time_total}s\nSIZE: %{size_download} bytes\n" "http://127.0.0.1:3001/${CHUNK}"

echo ""
echo "=== Memory & CPU ==="
free -m | head -2
echo ""
uptime
echo ""
echo "=== Docker stats (once) ==="
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null | head -15
