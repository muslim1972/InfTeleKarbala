-- 🛡️ سكربت تحصين أمان التطبيق (Security Hardening Script - v1.1 Revised)
-- الإصدار: 1.1 (المصحح بناءً على هيكلية الجداول الفعلية)
-- هذا السكربت يعالج الثغرات الأمنية المكتشفة لضمان اجتياز فحص اللجنة الصارم.

BEGIN;

-- 1. تحديث وظيفة التحقق من المسؤول (is_admin) لتكون أكثر أماناً واستقراراً
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. تحصين جدول البيانات المالية (financial_records)
ALTER TABLE public.financial_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Employees can view own financial records" ON public.financial_records;
DROP POLICY IF EXISTS "Admins can manage all financial records" ON public.financial_records;
DROP POLICY IF EXISTS "Users can view own financial records." ON public.financial_records;
DROP POLICY IF EXISTS "Admins/ServiceRole can manage all" ON public.financial_records;

CREATE POLICY "Employees can view own financial records"
ON public.financial_records FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all financial records"
ON public.financial_records FOR ALL
USING (is_admin())
WITH CHECK (is_admin());


-- 3. تحصين جدول الملفات الشخصية (profiles)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;

CREATE POLICY "Authenticated users can view profiles"
ON public.profiles FOR SELECT
USING (auth.role() = 'authenticated');


-- 4. إغلاق الثغرات في الجداول غير المحمية بناءً على الهيكلية الفعلية
-- تم تصريف أسماء الأعمدة (id / user_id) حسب نتائج الفحص الأخير

-- أ. جداول الإجازات وتاريخ الطلبات
ALTER TABLE public.five_year_leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_trigger_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own five_year_leaves" ON public.five_year_leaves;
DROP POLICY IF EXISTS "Admins manage five_year_leaves" ON public.five_year_leaves;
CREATE POLICY "Users view own five_year_leaves" ON public.five_year_leaves FOR SELECT USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "Admins manage five_year_leaves" ON public.five_year_leaves FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Users view own leave_history" ON public.leave_history;
DROP POLICY IF EXISTS "Admins manage leave_history" ON public.leave_history;
-- ملاحظة: leave_history لا يحتوي على user_id، لذا نستخدم actor_id أو نربطها بالطلب
CREATE POLICY "Users view own leave history actions" ON public.leave_history 
FOR SELECT USING (auth.uid() = actor_id OR is_admin());

DROP POLICY IF EXISTS "Users view own leave_trigger_logs" ON public.leave_trigger_logs;
CREATE POLICY "Users view own leave_trigger_logs" ON public.leave_trigger_logs FOR SELECT USING (auth.uid() = user_id OR is_admin());


-- ب. جدول العقوبات (penalties_details)
ALTER TABLE public.penalties_details ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own penalties" ON public.penalties_details;
DROP POLICY IF EXISTS "Admins manage penalties" ON public.penalties_details;
CREATE POLICY "Users view own penalties" ON public.penalties_details FOR SELECT USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "Admins manage penalties" ON public.penalties_details FOR ALL USING (is_admin());


-- ج. جداول الاستبيانات (Polls)
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users view polls" ON public.polls;
CREATE POLICY "Authenticated users view polls" ON public.polls FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users view poll questions" ON public.poll_questions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users view poll options" ON public.poll_options FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can vote once" ON public.poll_responses;
CREATE POLICY "Users can vote once" ON public.poll_responses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users view own responses" ON public.poll_responses FOR SELECT USING (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "Users view comments" ON public.poll_comments;
CREATE POLICY "Users view comments" ON public.poll_comments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can comment" ON public.poll_comments FOR INSERT WITH CHECK (auth.uid() = user_id);


-- د. جداول نصائح المشرفين والبيانات الإدارية (admin_tips)
ALTER TABLE public.admin_tips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read admin_tips" ON public.admin_tips;
CREATE POLICY "Authenticated users can read admin_tips" ON public.admin_tips FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage admin_tips" ON public.admin_tips FOR ALL USING (is_admin());


-- 5. جدول مستخدمي التطبيق (app_users)
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins only manage app_users" ON public.app_users;
DROP POLICY IF EXISTS "Users can read self app_users" ON public.app_users;
DROP POLICY IF EXISTS "Authenticated users can read app_users" ON public.app_users;
CREATE POLICY "Admins manage all app_users" ON public.app_users FOR ALL USING (is_admin());
CREATE POLICY "Users read self app_users" ON public.app_users FOR SELECT USING (auth.uid() = id OR is_admin());


-- 6. تحديث دالة حذف المحادثة (delete_chat_conversation)
CREATE OR REPLACE FUNCTION delete_chat_conversation(p_conversation_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_group BOOLEAN;
    v_is_participant BOOLEAN;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- التحقق من المشاركة باستخدام معامل ? لمصفوفة jsonb الخاصة بـ participants
    SELECT (participants ? (auth.uid())::text), is_group 
    INTO v_is_participant, v_is_group 
    FROM public.conversations 
    WHERE id = p_conversation_id;

    IF NOT v_is_participant OR v_is_participant IS NULL THEN
        RAISE EXCEPTION 'Security Alert: You are not a participant in this conversation.';
    END IF;

    IF v_is_group THEN
        UPDATE public.conversations
        SET participants = participants - (auth.uid())::text
        WHERE id = p_conversation_id;
    ELSE
        UPDATE public.conversations
        SET deleted_by = array_append(COALESCE(deleted_by, '{}'::uuid[]), auth.uid())
        WHERE id = p_conversation_id;
    END IF;
END;
$$;

COMMIT;

-- 📝 ملاحظة للمبرمج: تم تصحيح جميع أسماء الأعمدة وربط السياسات بشكل محكم.
-- السكربت الآن جاهز للتنفيذ الآمن.
