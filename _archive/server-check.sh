#!/bin/bash
# فحص حالة خادم SPA على VPS
echo "=== حالة الخادم ==="
echo "--- عمليات spa_server ---"
ps aux | grep spa_server | grep -v grep
echo "--- المنافذ المفتوحة ---"
ss -tlnp | grep -E '3000|8080|80' | head -5
echo "--- آخر سجلات spa_server ---"
journalctl -u spa_server --no-pager -n 10 2>/dev/null || tail -20 /home/muslim/spa_server.log 2>/dev/null || echo "لا سجلات"
echo "=== الفحص مكتمل ==="
