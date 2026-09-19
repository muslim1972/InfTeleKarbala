#!/bin/bash
# فحص تشغيلي: التحقق من تقديم البناء الجديد
echo "== مراجع index.html المقدَّم =="
curl -s http://127.0.0.1/ | grep -oE 'assets/index-[A-Za-z0-9_-]+\.(js|css)' | head -4
echo "== جلب حزم المحاكي =="
curl -s -o /dev/null -w 'workspace_new:%{http_code}\n' http://127.0.0.1/assets/FiberSimulatorWorkspace-BFiPAmvq.js
curl -s -o /dev/null -w 'launcher_new:%{http_code}\n' http://127.0.0.1/assets/FiberSimulatorLauncher-BtnwJcBj.js
echo "== التأكد من خلو البناء الجديد من المرجع المكسور =="
curl -s http://127.0.0.1/assets/FiberSimulatorWorkspace-BFiPAmvq.js | grep -c 'showGeoHelp' || true
