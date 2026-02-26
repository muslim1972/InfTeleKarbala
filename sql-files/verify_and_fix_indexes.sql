-- ============================================
-- سكربت التحقق من الفهارس وإصلاحها
-- نفّذ هذا في Supabase SQL Editor
-- ============================================

-- 1. التحقق من وجود الفهارس الحالية
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename IN ('media_content', 'user_acknowledgments', 'polls', 'poll_questions', 'poll_options');

-- 2. إنشاء الفهارس المفقودة

-- فهارس media_content (مهم جداً!)
CREATE INDEX IF NOT EXISTS idx_media_content_type_active 
ON media_content(type, is_active);

CREATE INDEX IF NOT EXISTS idx_media_content_is_active 
ON media_content(is_active);

-- فهارس user_acknowledgments (مهم جداً!)
CREATE INDEX IF NOT EXISTS idx_user_acknowledgments_user_id 
ON user_acknowledgments(user_id);

CREATE INDEX IF NOT EXISTS idx_user_acknowledgments_content_id 
ON user_acknowledgments(content_id);

CREATE INDEX IF NOT EXISTS idx_user_acknowledgments_user_content 
ON user_acknowledgments(user_id, content_id);

-- فهارس الاستطلاعات
CREATE INDEX IF NOT EXISTS idx_polls_is_deleted 
ON polls(is_deleted);

CREATE INDEX IF NOT EXISTS idx_poll_questions_poll_id 
ON poll_questions(poll_id);

CREATE INDEX IF NOT EXISTS idx_poll_options_question_id 
ON poll_options(question_id);

-- 3. تحليل الجداول لتحديث الإحصائيات
ANALYZE media_content;
ANALYZE user_acknowledgments;
ANALYZE polls;
ANALYZE poll_questions;
ANALYZE poll_options;

-- 4. التحقق من النتيجة
SELECT 
    t.tablename,
    COUNT(i.indexname) as index_count
FROM pg_tables t
LEFT JOIN pg_indexes i ON t.tablename = i.tablename AND i.schemaname = 'public'
WHERE t.schemaname = 'public' 
  AND t.tablename IN ('media_content', 'user_acknowledgments', 'polls', 'poll_questions', 'poll_options')
GROUP BY t.tablename;
