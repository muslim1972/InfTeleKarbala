-- ============================================
-- فهارس إضافية لجداول الاستطلاعات
-- نفّذ هذا في Supabase SQL Editor
-- ============================================

-- فهارس مهمة جداً لـ poll_responses
CREATE INDEX IF NOT EXISTS idx_poll_responses_poll_user 
ON poll_responses(poll_id, user_id);

CREATE INDEX IF NOT EXISTS idx_poll_responses_user_id 
ON poll_responses(user_id);

-- فهارس لـ poll_comments
CREATE INDEX IF NOT EXISTS idx_poll_comments_poll_user 
ON poll_comments(poll_id, user_id);

CREATE INDEX IF NOT EXISTS idx_poll_comments_user_id 
ON poll_comments(user_id);

-- تحليل الجداول
ANALYZE poll_responses;
ANALYZE poll_comments;

-- التحقق
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename IN ('poll_responses', 'poll_comments');
