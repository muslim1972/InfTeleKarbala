-- ============================================
-- إضافة الفهارس لتحسين الأداء
-- يجب تنفيذ هذا الملف في Supabase SQL Editor
-- ============================================

-- 1. فهارس على جدول media_content
-- للبحث السريع عن التوجيهات والنشاطات النشطة
CREATE INDEX IF NOT EXISTS idx_media_content_type_active 
ON media_content(type, is_active);

CREATE INDEX IF NOT EXISTS idx_media_content_type 
ON media_content(type);

CREATE INDEX IF NOT EXISTS idx_media_content_is_active 
ON media_content(is_active);

-- 2. فهارس على جدول user_acknowledgments
-- للبحث السريع عن إقرارات المستخدم
CREATE INDEX IF NOT EXISTS idx_user_acknowledgments_user_id 
ON user_acknowledgments(user_id);

CREATE INDEX IF NOT EXISTS idx_user_acknowledgments_content_id 
ON user_acknowledgments(content_id);

-- فهرس مركب للبحث الأكثر شيوعاً
CREATE INDEX IF NOT EXISTS idx_user_acknowledgments_user_content 
ON user_acknowledgments(user_id, content_id);

-- 3. فهارس على جداول الاستطلاعات (إذا كبر حجمها)
CREATE INDEX IF NOT EXISTS idx_polls_is_deleted 
ON polls(is_deleted);

CREATE INDEX IF NOT EXISTS idx_poll_questions_poll_id 
ON poll_questions(poll_id);

CREATE INDEX IF NOT EXISTS idx_poll_options_question_id 
ON poll_options(question_id);

CREATE INDEX IF NOT EXISTS idx_poll_responses_user_id 
ON poll_responses(user_id);

-- 4. فهارس على جداول السجلات الإدارية
CREATE INDEX IF NOT EXISTS idx_thanks_details_user_year 
ON thanks_details(user_id, year);

CREATE INDEX IF NOT EXISTS idx_committees_details_user_year 
ON committees_details(user_id, year);

CREATE INDEX IF NOT EXISTS idx_penalties_details_user_year 
ON penalties_details(user_id, year);

CREATE INDEX IF NOT EXISTS idx_leaves_details_user_year 
ON leaves_details(user_id, year);

-- 5. فهارس على جداول البيانات المالية
CREATE INDEX IF NOT EXISTS idx_financial_records_user_id 
ON financial_records(user_id);

CREATE INDEX IF NOT EXISTS idx_administrative_summary_user_id 
ON administrative_summary(user_id);

CREATE INDEX IF NOT EXISTS idx_yearly_records_user_id 
ON yearly_records(user_id);

CREATE INDEX IF NOT EXISTS idx_yearly_records_user_year 
ON yearly_records(user_id, year);

-- 6. فهرس على جدول admin_tips
CREATE INDEX IF NOT EXISTS idx_admin_tips_app_name 
ON admin_tips(app_name);

-- ============================================
-- تحقق من إنشاء الفهارس
-- ============================================
-- SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public';
