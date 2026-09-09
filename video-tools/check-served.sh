#!/bin/bash
echo '=== index.html المُخدوم الآن ==='
curl -s http://127.0.0.1:3001/ | grep -o 'index-[^"]*\.js'
echo '=== ترويسات index.html ==='
curl -sI http://127.0.0.1:3001/ | head -15
echo '=== ملفات index في dist ==='
ls /home/muslim/inftelekarbala/dist/assets/ | grep '^index'
echo '=== عدد ذكر activate_monthly_snapshot في الحزمة المخدومة ==='
grep -c 'activate_monthly_snapshot' /home/muslim/inftelekarbala/dist/assets/index-*.js
echo '=== هل توجد أي delete() مباشر في الحزمة المخدومة ==='
grep -c '\.delete()' /home/muslim/inftelekarbala/dist/assets/index-*.js
