#!/bin/bash
# فحص دوال دورات الترفيع + أعمدة profiles + RLS
echo "=== 1) تعريف set_promotion_permission ==="
docker exec -i supabase-db psql -U postgres -t -c "SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='set_promotion_permission';"

echo "=== 2) تواقيع الدوال الثلاث ==="
docker exec -i supabase-db psql -U postgres -t -c "SELECT p.proname, pg_get_function_arguments(p.oid), p.prosecdef FROM pg_proc p WHERE p.proname IN ('set_promotion_permission','search_promotion_candidates','get_promotion_users');"

echo "=== 3) أعمدة الصلاحية في profiles ==="
docker exec -i supabase-db psql -U postgres -t -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='profiles' AND column_name IN ('is_promotion_lecturer','can_access_promotion','promotion_course_type','promotion_subject_name','governorate','admin_role');"

echo "=== 4) RLS على profiles ==="
docker exec -i supabase-db psql -U postgres -t -c "SELECT relname, relrowsecurity FROM pg_class WHERE relname='profiles';"
docker exec -i supabase-db psql -U postgres -t -c "SELECT policyname, cmd, roles FROM pg_policies WHERE tablename='profiles';"

echo "=== 5) توزيع المشرفين الحاليين ==="
docker exec -i supabase-db psql -U postgres -t -c "SELECT governorate, count(*) FROM profiles WHERE is_promotion_lecturer=true GROUP BY governorate;"
