#!/bin/bash
# OPS-02: تنفيذ ملف SQL داخل حاوية supabase-db.
# الاستخدام: VPS_PW=... bash runsql.sh /tmp/file.sql [db_user]   (db_user افتراضياً postgres؛ استخدم supabase_admin لدوال يملكها)
U=${2:-postgres}
echo "$VPS_PW" | sudo -S sh -c "C=\$(docker ps --format '{{.Names}}' | grep -m1 db); docker exec -i \$C psql -U $U -d postgres -v ON_ERROR_STOP=1 < $1" 2>&1 | grep -v '^\[sudo\]'
