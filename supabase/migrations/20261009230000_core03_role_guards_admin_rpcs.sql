-- BE-CORE-03 / إصلاح أمني — المرحلة 2 (2026-10-09)
-- الهدف: منع أي موظف مسجّل (authenticated) من تنفيذ دوال إدارية حساسة.
-- الأسلوب: الدالة الأصلية تُعاد تسميتها إلى <name>__impl وتُغلق كلياً، وتُنشأ دالة بنفس الاسم والتوقيع
-- تتحقق من الدور ثم تستدعي __impl. الواجهة لا تتغيّر (نفس الاسم والمعاملات).
-- يُنفَّذ بـ supabase_admin (مالك بعض الدوال).
-- الاسترجاع: انظر نهاية الملف.

BEGIN;

-- مساعد مركزي: يرفع استثناءً إن لم يكن المستدعي ضمن الأدوار المسموحة
CREATE OR REPLACE FUNCTION public.core_require_role(p_roles text[])
RETURNS public.profiles LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE me public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501'; END IF;
  SELECT * INTO me FROM public.profiles WHERE id = auth.uid();
  -- role='admin' وحده لا يكفي (كل المدراء role=admin)؛ يُقبل فقط إن لم يكن له admin_role (مدير عام قديم)
  IF me.id IS NULL OR NOT (coalesce(me.admin_role, '') = ANY (p_roles) OR (me.role = 'admin' AND me.admin_role IS NULL)) THEN
    RAISE EXCEPTION 'forbidden: role not allowed' USING ERRCODE = '42501';
  END IF;
  RETURN me;
END $$;
REVOKE ALL ON FUNCTION public.core_require_role(text[]) FROM PUBLIC, anon, authenticated;

-- 1) rpc_sync_user_auth: تغيير كلمة سر/بريد موظف
ALTER FUNCTION public.rpc_sync_user_auth(uuid, text, text) RENAME TO rpc_sync_user_auth__impl;
REVOKE ALL ON FUNCTION public.rpc_sync_user_auth__impl(uuid, text, text) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.rpc_sync_user_auth(p_user_id uuid, p_email text, p_password text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me public.profiles; t public.profiles;
BEGIN
  me := public.core_require_role(ARRAY['developer','it_supervisor','general','hr']);
  SELECT * INTO t FROM public.profiles WHERE id = p_user_id;
  IF coalesce(me.admin_role,'') NOT IN ('developer','it_supervisor') THEN
    IF coalesce(t.admin_role,'') IN ('developer','it_supervisor') THEN RAISE EXCEPTION 'forbidden: cannot modify developer-level account' USING ERRCODE = '42501'; END IF;
    IF t.id IS NOT NULL AND t.governorate IS DISTINCT FROM me.governorate THEN RAISE EXCEPTION 'forbidden: cross-governorate' USING ERRCODE = '42501'; END IF;
  END IF;
  RETURN public.rpc_sync_user_auth__impl(p_user_id, p_email, p_password);
END $$;

-- 2) rpc_delete_user_robust: حذف موظف
ALTER FUNCTION public.rpc_delete_user_robust(uuid) RENAME TO rpc_delete_user_robust__impl;
REVOKE ALL ON FUNCTION public.rpc_delete_user_robust__impl(uuid) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.rpc_delete_user_robust(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me public.profiles; t public.profiles;
BEGIN
  me := public.core_require_role(ARRAY['developer','it_supervisor','general']);
  SELECT * INTO t FROM public.profiles WHERE id = p_user_id;
  IF p_user_id = me.id THEN RAISE EXCEPTION 'forbidden: cannot delete self' USING ERRCODE = '42501'; END IF;
  IF coalesce(me.admin_role,'') NOT IN ('developer','it_supervisor') THEN
    IF coalesce(t.admin_role,'') IN ('developer','it_supervisor') THEN RAISE EXCEPTION 'forbidden: cannot delete developer-level account' USING ERRCODE = '42501'; END IF;
    IF t.id IS NOT NULL AND t.governorate IS DISTINCT FROM me.governorate THEN RAISE EXCEPTION 'forbidden: cross-governorate' USING ERRCODE = '42501'; END IF;
  END IF;
  PERFORM public.rpc_delete_user_robust__impl(p_user_id);
END $$;

-- 3) اللقطات الشهرية (المالية)
ALTER FUNCTION public.activate_monthly_snapshot(uuid) RENAME TO activate_monthly_snapshot__impl;
ALTER FUNCTION public.commit_monthly_snapshot(text, text, text, text, boolean) RENAME TO commit_monthly_snapshot__impl;
ALTER FUNCTION public.delete_monthly_snapshot(uuid) RENAME TO delete_monthly_snapshot__impl;
ALTER FUNCTION public.sync_active_monthly_snapshot(text) RENAME TO sync_active_monthly_snapshot__impl;
REVOKE ALL ON FUNCTION public.activate_monthly_snapshot__impl(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commit_monthly_snapshot__impl(text, text, text, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_monthly_snapshot__impl(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_active_monthly_snapshot__impl(text) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.activate_monthly_snapshot(p_snapshot_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.core_require_role(ARRAY['developer','it_supervisor','general','finance','hr']);
  RETURN public.activate_monthly_snapshot__impl(p_snapshot_id); END $$;
CREATE FUNCTION public.commit_monthly_snapshot(p_name text, p_source text DEFAULT 'excel', p_creator_name text DEFAULT NULL, p_governorate text DEFAULT 'karbala', p_sync_current boolean DEFAULT true)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.core_require_role(ARRAY['developer','it_supervisor','general','finance','hr']);
  RETURN public.commit_monthly_snapshot__impl(p_name, p_source, p_creator_name, p_governorate, p_sync_current); END $$;
CREATE FUNCTION public.delete_monthly_snapshot(p_snapshot_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.core_require_role(ARRAY['developer','it_supervisor','general','finance']);
  PERFORM public.delete_monthly_snapshot__impl(p_snapshot_id); END $$;
CREATE FUNCTION public.sync_active_monthly_snapshot(p_governorate text DEFAULT 'karbala')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.core_require_role(ARRAY['developer','it_supervisor','general','finance','hr']);
  PERFORM public.sync_active_monthly_snapshot__impl(p_governorate); END $$;

-- 4) نسخ شجرة الأقسام لمحافظة
ALTER FUNCTION public.clone_departments_tree(text) RENAME TO clone_departments_tree__impl;
REVOKE ALL ON FUNCTION public.clone_departments_tree__impl(text) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.clone_departments_tree(target_gov text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.core_require_role(ARRAY['developer','it_supervisor','general']);
  PERFORM public.clone_departments_tree__impl(target_gov); END $$;

-- 5) البت في طلب تغيير الجهاز — p_admin_id كان يُؤخذ من العميل (انتحال)؛ الآن يُفرض auth.uid()
ALTER FUNCTION public.settle_device_change_request(uuid, text, uuid) RENAME TO settle_device_change_request__impl;
REVOKE ALL ON FUNCTION public.settle_device_change_request__impl(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.settle_device_change_request(p_request_id uuid, p_action text, p_admin_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.core_require_role(ARRAY['developer','it_supervisor','general','biometric','attendance_supervisor']);
  RETURN public.settle_device_change_request__impl(p_request_id, p_action, auth.uid()); END $$;

-- 6) حذف رسالة لمستخدم — لا يجوز لغير صاحب الحساب
ALTER FUNCTION public.append_deleted_by(uuid, uuid) RENAME TO append_deleted_by__impl;
REVOKE ALL ON FUNCTION public.append_deleted_by__impl(uuid, uuid) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.append_deleted_by(p_message_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  PERFORM public.append_deleted_by__impl(p_message_id, p_user_id);
END $$;

-- 7) hash_password: لا حاجة للمجهول (تستدعيه دوال DEFINER داخلياً كمالك)
REVOKE EXECUTE ON FUNCTION public.hash_password(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hash_password(text) TO authenticated, service_role;

-- صلاحيات الأغلفة: مسجّل فقط
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN ('rpc_sync_user_auth','rpc_delete_user_robust','activate_monthly_snapshot','commit_monthly_snapshot','delete_monthly_snapshot','sync_active_monthly_snapshot','clone_departments_tree','settle_device_change_request','append_deleted_by')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END $$;

COMMIT;

-- الاسترجاع (لكل دالة X):
--   DROP FUNCTION public.X(<sig>); ALTER FUNCTION public.X__impl(<sig>) RENAME TO X;
--   GRANT EXECUTE ON FUNCTION public.X(<sig>) TO authenticated;
