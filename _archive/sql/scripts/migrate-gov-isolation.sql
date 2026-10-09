-- =====================================================================================
-- Migration: عزل العموميات (الإعلام/الاستطلاعات/الشريط الإخباري) بالمحافظة
-- التاريخ: 2026-09-19
-- السبب: موظف بابل كان يرى محتوى كربلاء في تبويب الاعلام (سياسات SELECT مفتوحة
--        تُجمَع بمنطق OR فتُبطل سياسات العزل) + رابط الشريط الإخباري المفتوح.
-- المنهج:
--   1) حذف كل السياسات على الجداول الثمانية وإعادة بنائها بشكل صارم وموحد.
--   2) كل القراءة محصورة بمحافظة الموظف (حتى الأدمن — أمن أولاً).
--   3) كل الكتابة: أدمن + محافظته فقط.
--   4) دوال مساعدة SECURITY DEFINER لفحص انتماء poll/media لمحافظة المستخدم
--      (تفادي أي استدعاء متداخل لـ RLS).
-- ملاحظة: كل الصفوف الحالية governorate='karbala' — لا حاجة لـ backfill.
-- =====================================================================================

\set ON_ERROR_STOP on

BEGIN;

-- -------------------------------------------------------------------------------------
-- 1) دوال مساعدة (idempotent)
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.poll_in_my_gov(_poll_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.polls
    WHERE id = _poll_id AND governorate = get_my_governorate()
  );
$$;

CREATE OR REPLACE FUNCTION public.media_in_my_gov(_content_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.media_content
    WHERE id = _content_id AND governorate = get_my_governorate()
  );
$$;

GRANT EXECUTE ON FUNCTION public.poll_in_my_gov(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.media_in_my_gov(uuid) TO authenticated;

-- -------------------------------------------------------------------------------------
-- 2) حذف كل السياسات الحالية على الجداول الثمانية (تشمل المفتوحة المُبَطِّلة للعزل)
-- -------------------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'polls', 'media_content',
        'poll_questions', 'poll_options',
        'poll_comments', 'poll_responses',
        'user_acknowledgments', 'admin_tips'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- -------------------------------------------------------------------------------------
-- 3) تفعيل RLS (مؤكَّد)
-- -------------------------------------------------------------------------------------
ALTER TABLE public.polls                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_content         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_questions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_comments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_responses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_acknowledgments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_tips            ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------------------------
-- 4) polls — الاستطلاعات
-- -------------------------------------------------------------------------------------
CREATE POLICY "polls_select_my_gov" ON public.polls
  FOR SELECT TO authenticated
  USING (governorate = get_my_governorate());

CREATE POLICY "polls_insert_admin_my_gov" ON public.polls
  FOR INSERT TO authenticated
  WITH CHECK (is_admin() AND governorate = get_my_governorate());

CREATE POLICY "polls_update_admin_my_gov" ON public.polls
  FOR UPDATE TO authenticated
  USING (is_admin() AND governorate = get_my_governorate())
  WITH CHECK (is_admin() AND governorate = get_my_governorate());

CREATE POLICY "polls_delete_admin_my_gov" ON public.polls
  FOR DELETE TO authenticated
  USING (is_admin() AND governorate = get_my_governorate());

-- -------------------------------------------------------------------------------------
-- 5) media_content — التوجيهات/النشاطات/روابط الاستطلاعات
-- -------------------------------------------------------------------------------------
CREATE POLICY "media_select_my_gov" ON public.media_content
  FOR SELECT TO authenticated
  USING (governorate = get_my_governorate());

CREATE POLICY "media_insert_admin_my_gov" ON public.media_content
  FOR INSERT TO authenticated
  WITH CHECK (is_admin() AND governorate = get_my_governorate());

CREATE POLICY "media_update_admin_my_gov" ON public.media_content
  FOR UPDATE TO authenticated
  USING (is_admin() AND governorate = get_my_governorate())
  WITH CHECK (is_admin() AND governorate = get_my_governorate());

CREATE POLICY "media_delete_admin_my_gov" ON public.media_content
  FOR DELETE TO authenticated
  USING (is_admin() AND governorate = get_my_governorate());

-- -------------------------------------------------------------------------------------
-- 6) poll_questions — الأسئلة (تتبع محافظة الاستطلاع الأب)
-- -------------------------------------------------------------------------------------
CREATE POLICY "poll_questions_select_my_gov" ON public.poll_questions
  FOR SELECT TO authenticated
  USING (poll_in_my_gov(poll_id));

CREATE POLICY "poll_questions_insert_admin_my_gov" ON public.poll_questions
  FOR INSERT TO authenticated
  WITH CHECK (is_admin() AND poll_in_my_gov(poll_id));

CREATE POLICY "poll_questions_update_admin_my_gov" ON public.poll_questions
  FOR UPDATE TO authenticated
  USING (is_admin() AND poll_in_my_gov(poll_id))
  WITH CHECK (is_admin() AND poll_in_my_gov(poll_id));

CREATE POLICY "poll_questions_delete_admin_my_gov" ON public.poll_questions
  FOR DELETE TO authenticated
  USING (is_admin() AND poll_in_my_gov(poll_id));

-- -------------------------------------------------------------------------------------
-- 7) poll_options — الخيارات (تتبع محافظة السؤال → الاستطلاع)
-- -------------------------------------------------------------------------------------
CREATE POLICY "poll_options_select_my_gov" ON public.poll_options
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.poll_questions q
    WHERE q.id = poll_options.question_id
      AND poll_in_my_gov(q.poll_id)
  ));

CREATE POLICY "poll_options_insert_admin_my_gov" ON public.poll_options
  FOR INSERT TO authenticated
  WITH CHECK (is_admin() AND EXISTS (
    SELECT 1 FROM public.poll_questions q
    WHERE q.id = poll_options.question_id
      AND poll_in_my_gov(q.poll_id)
  ));

CREATE POLICY "poll_options_update_admin_my_gov" ON public.poll_options
  FOR UPDATE TO authenticated
  USING (is_admin() AND EXISTS (
    SELECT 1 FROM public.poll_questions q
    WHERE q.id = poll_options.question_id
      AND poll_in_my_gov(q.poll_id)
  ))
  WITH CHECK (is_admin() AND EXISTS (
    SELECT 1 FROM public.poll_questions q
    WHERE q.id = poll_options.question_id
      AND poll_in_my_gov(q.poll_id)
  ));

CREATE POLICY "poll_options_delete_admin_my_gov" ON public.poll_options
  FOR DELETE TO authenticated
  USING (is_admin() AND EXISTS (
    SELECT 1 FROM public.poll_questions q
    WHERE q.id = poll_options.question_id
      AND poll_in_my_gov(q.poll_id)
  ));

-- -------------------------------------------------------------------------------------
-- 8) poll_comments — التعليقات
-- -------------------------------------------------------------------------------------
CREATE POLICY "poll_comments_select_my_gov" ON public.poll_comments
  FOR SELECT TO authenticated
  USING (poll_in_my_gov(poll_id));

CREATE POLICY "poll_comments_insert_own_my_gov" ON public.poll_comments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND poll_in_my_gov(poll_id));

CREATE POLICY "poll_comments_delete_own_or_admin_my_gov" ON public.poll_comments
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR (is_admin() AND poll_in_my_gov(poll_id)));

-- -------------------------------------------------------------------------------------
-- 9) poll_responses — الردود (التصويت)
-- -------------------------------------------------------------------------------------
CREATE POLICY "poll_responses_select_own_or_admin_my_gov" ON public.poll_responses
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (is_admin() AND poll_in_my_gov(poll_id)));

CREATE POLICY "poll_responses_insert_own_my_gov" ON public.poll_responses
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND poll_in_my_gov(poll_id));

CREATE POLICY "poll_responses_update_own" ON public.poll_responses
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "poll_responses_delete_own" ON public.poll_responses
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- -------------------------------------------------------------------------------------
-- 10) user_acknowledgments — الإقرارات
-- -------------------------------------------------------------------------------------
CREATE POLICY "user_ack_select_own_or_admin_my_gov" ON public.user_acknowledgments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (is_admin() AND media_in_my_gov(content_id)));

CREATE POLICY "user_ack_insert_own_my_gov" ON public.user_acknowledgments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND media_in_my_gov(content_id));

-- -------------------------------------------------------------------------------------
-- 11) admin_tips — الشريط الإخباري (كان SELECT مفتوحاً true للجميع)
-- -------------------------------------------------------------------------------------
CREATE POLICY "admin_tips_select_my_gov" ON public.admin_tips
  FOR SELECT TO authenticated
  USING (governorate = get_my_governorate());

CREATE POLICY "admin_tips_insert_admin_my_gov" ON public.admin_tips
  FOR INSERT TO authenticated
  WITH CHECK (is_admin() AND governorate = get_my_governorate());

CREATE POLICY "admin_tips_update_admin_my_gov" ON public.admin_tips
  FOR UPDATE TO authenticated
  USING (is_admin() AND governorate = get_my_governorate())
  WITH CHECK (is_admin() AND governorate = get_my_governorate());

CREATE POLICY "admin_tips_delete_admin_my_gov" ON public.admin_tips
  FOR DELETE TO authenticated
  USING (is_admin() AND governorate = get_my_governorate());

COMMIT;

-- -------------------------------------------------------------------------------------
-- 12) تحقق نهائي: لا توجد أي سياسة مفتوحة، وعدد السياسات لكل جدول
-- -------------------------------------------------------------------------------------
\echo '=== policies count per table ==='
SELECT tablename, count(*) AS policies
FROM pg_policies
WHERE schemaname='public'
  AND tablename IN ('polls','media_content','poll_questions','poll_options','poll_comments','poll_responses','user_acknowledgments','admin_tips')
GROUP BY tablename ORDER BY tablename;

\echo '=== any open policy left? (must be 0 rows) ==='
SELECT tablename, policyname, qual, with_check
FROM pg_policies
WHERE schemaname='public'
  AND tablename IN ('polls','media_content','poll_questions','poll_options','poll_comments','poll_responses','user_acknowledgments','admin_tips')
  AND (qual IN ('true','(true)') OR with_check IN ('true','(true)'));

\echo '=== migration OK ==='
