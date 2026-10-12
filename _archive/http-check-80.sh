#!/bin/bash
# فحص HTTP للتطبيق على VPS - المنفذ 80
echo "=== فحص HTTP (المنفذ 80) ==="
echo -n "التطبيق الرئيسي: "
curl -s -o /dev/null -w "%{http_code}" http://localhost:80/
echo ""
echo -n "FiberSimulatorWorkspace: "
curl -s -o /dev/null -w "%{http_code}" http://localhost:80/assets/FiberSimulatorWorkspace-Bpf0vhDM.js
echo ""
echo -n "FiberSimulatorLauncher: "
curl -s -o /dev/null -w "%{http_code}" http://localhost:80/assets/FiberSimulatorLauncher-CVatCwY8.js
echo ""
echo -n "index.html: "
curl -s -o /dev/null -w "%{http_code}" http://localhost:80/index.html
echo ""
echo "=== الفحص مكتمل ==="
