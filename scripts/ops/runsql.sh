#!/bin/bash
# OPS-02: تنفيذ ملف SQL داخل حاوية supabase-db. الاستخدام: bash runsql.sh /tmp/file.sql  (كلمة السر من المتغير VPS_PW)
echo "$VPS_PW" | sudo -S sh -c "C=\$(docker ps --format '{{.Names}}' | grep -m1 db); docker exec -i \$C psql -U postgres -d postgres -v ON_ERROR_STOP=1 < $1" 2>&1 | grep -v '^\[sudo\]'
