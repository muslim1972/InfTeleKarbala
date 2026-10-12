#!/bin/bash
# فحص HTTP للتطبيق على VPS
echo "=== فحص HTTP ==="
echo -n "التطبيق الرئيسي: "
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/
echo ""
echo -n "FiberSimulatorWorkspace: "
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/assets/FiberSimulatorWorkspace-Bpf0vhDM.js
echo ""
echo -n "FiberSimulatorLauncher: "
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/assets/FiberSimulatorLauncher-CVatCwY8.js
echo ""
echo "=== الفحص مكتمل ==="
