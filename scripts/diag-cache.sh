#!/bin/bash
# تشخيص: كاش المتصفح + ترويسات index.html + الأسماء في الحزم القديمة
echo "== البحث عن نص البداية السريعة في كل حزم dist (القديمة والجديدة) =="
grep -l "البداية السريعة" /home/muslim/inftelekarbala/dist/assets/*.js 2>/dev/null || echo "غير موجود في أي حزمة"

echo "== ترويسات index.html =="
curl -sI http://127.0.0.1/ | head -20

echo "== حزم workspace الموجودة على VPS =="
ls -lt /home/muslim/inftelekarbala/dist/assets/ | grep FiberSimulatorWorkspace | head -6

echo "== هل حزمة workspace الحديثة تحوي عزل المالك =="
grep -c "gis-maps" /home/muslim/inftelekarbala/dist/assets/index-vULTlIyk.js
