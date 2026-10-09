#!/bin/bash
# تنفيذ ملف SQL موَلد عبر وسيط $1 ثم عرض تعريف الدالة الخماسية للتحقق
docker exec -i supabase-db psql -U postgres -v ON_ERROR_STOP=1 < "$1"
echo "=== EXIT: $? ==="
docker exec -i supabase-db psql -U postgres -t -A -c "SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='set_promotion_permission' AND pronargs=5;" | head -30
