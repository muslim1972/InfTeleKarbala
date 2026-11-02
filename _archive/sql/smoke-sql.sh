#!/bin/bash
# OPS-03: الفحص الدخاني المحمي (Smoke Invocation Gate) للمسلمة السادسة
# الاستخدام: VPS_PW=... bash smoke-sql.sh /tmp/file.sql [db_user]
U=${2:-postgres}

# إنشاء ملف مؤقت يغلف الكود بمعاملة وهمية
echo "BEGIN;" > /tmp/smoke_run.sql
cat $1 >> /tmp/smoke_run.sql
echo "ROLLBACK;" >> /tmp/smoke_run.sql

echo "=== بدء الفحص الدخاني (Dry-Run) للمسلمة السادسة ==="
echo "$VPS_PW" | sudo -S sh -c "C=\$(docker ps --format '{{.Names}}' | grep -m1 db); docker exec -i \$C psql -U $U -d postgres -v ON_ERROR_STOP=1 < /tmp/smoke_run.sql" 2>&1 | grep -v '^\[sudo\]'

if [ ${PIPESTATUS[1]} -eq 0 ]; then
    echo "=== الفحص الدخاني ناجح: لا توجد أخطاء هيكلية (هلوسة أعمدة). يمكنك الآن تنفيذ الكود نهائياً. ==="
    exit 0
else
    echo "=== الفحص الدخاني فشل: تم اكتشاف خطأ هيكلي (انتهاك المسلمة السادسة). يُمنع التنفيذ النهائي. ==="
    exit 1
fi
