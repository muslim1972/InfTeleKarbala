#!/bin/bash
echo "=== SPA_SERVER.PY ==="
head -n 50 /home/muslim/inftelekarbala/spa_server.py
echo "=== SYSTEMD SERVICES FOR SPA OR WEB ==="
systemctl list-units --type=service --state=running | grep -iE 'spa|inftele|web|front'
echo "=== KONG CONFIG OR DOCKER COMPOSE ==="
ls -la /home/muslim/inftelekarbala/
find /home/muslim -name "docker-compose*.yml" -o -name "kong.yml" 2>/dev/null
