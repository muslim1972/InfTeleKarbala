#!/bin/bash
echo "=== فحص HTTP (المنفذ 80) ==="
echo -n "التطبيق الرئيسي: "
curl -s -o /dev/null -w "%{http_code}" http://localhost:80/
echo ""
echo -n "FiberSimulatorWorkspace: "
curl -s -o /dev/null -w "%{http_code}" http://localhost:80/assets/FiberSimulatorWorkspace-EWk9cv6t.js
echo ""
echo -n "FiberSimulatorLauncher: "
curl -s -o /dev/null -w "%{http_code}" http://localhost:80/assets/FiberSimulatorLauncher-BePp2ijY.js
echo ""
echo "=== الفحص مكتمل ==="
