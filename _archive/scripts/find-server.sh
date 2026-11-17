#!/bin/bash
echo "=== PROCESSES ==="
ps aux | grep -iE 'nginx|caddy|apache|node|docker|python' | grep -v grep
echo "=== LISTENING PORTS ==="
ss -tulpn | grep -E '80|443|3000|8000|5432'
echo "=== DOCKER CONTAINERS ==="
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
