-- ==================================================
-- حذف جدول app_users المهجور بأمان
-- ==================================================
-- الهدف: فصل جميع القيود الخارجية (Foreign Keys) التي تشير إلى app_users
--         ثم حذف الجدول نهائياً.
-- ملاحظة: الأعمدة نفسها (مثل last_modified_by, changed_by, updated_by)
--          ستبقى في جداولها لأنها تحتوي على بيانات مفيدة.
--          فقط القيود (constraints) هي التي ستُحذف.
-- ==================================================

BEGIN;

-- ========================================
-- الخطوة 1: فصل القيود الخارجية من الجداول
-- ========================================

-- 1.1 financial_records.last_modified_by → app_users(id)
ALTER TABLE public.financial_records 
DROP CONSTRAINT IF EXISTS financial_records_last_modified_by_fkey;

-- 1.2 administrative_summary.last_modified_by → app_users(id)
ALTER TABLE public.administrative_summary 
DROP CONSTRAINT IF EXISTS administrative_summary_last_modified_by_fkey;

-- 1.3 yearly_records.last_modified_by → app_users(id)
ALTER TABLE public.yearly_records 
DROP CONSTRAINT IF EXISTS yearly_records_last_modified_by_fkey;

-- 1.4 login_logs.user_id → app_users(id)
ALTER TABLE public.login_logs 
DROP CONSTRAINT IF EXISTS login_logs_user_id_fkey;

-- 1.5 field_change_logs.changed_by → app_users(id)
ALTER TABLE public.field_change_logs 
DROP CONSTRAINT IF EXISTS field_change_logs_changed_by_fkey;

-- 1.6 media_content.updated_by → app_users(id)
ALTER TABLE public.media_content 
DROP CONSTRAINT IF EXISTS media_content_updated_by_fkey;

-- 1.7 app_users.last_modified_by → app_users(id) (ذاتي المرجع)
ALTER TABLE public.app_users 
DROP CONSTRAINT IF EXISTS app_users_last_modified_by_fkey;

-- ========================================
-- الخطوة 2: حذف التريغرات المرتبطة بالجدول
-- ========================================
DROP TRIGGER IF EXISTS trg_audit_app_users ON public.app_users;

-- ========================================
-- الخطوة 3: حذف سياسات RLS
-- ========================================
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.app_users;

-- ========================================
-- الخطوة 4: حذف الجدول نهائياً
-- ========================================
DROP TABLE IF EXISTS public.app_users CASCADE;

COMMIT;

-- ========================================
-- تحقق: التأكد من أن الجدول حُذف بنجاح
-- ========================================
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'app_users'
) AS app_users_still_exists;
