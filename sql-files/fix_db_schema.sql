
-- 🛠️ إصلاح هيكل قاعدة البيانات
-- 1. إضافة أعمدة التدقيق (Audit Columns) الناقصة للجداول

-- جدول السجلات المالية
ALTER TABLE public.financial_records
ADD COLUMN IF NOT EXISTS last_modified_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
ADD COLUMN IF NOT EXISTS last_modified_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS last_modified_by_name text;

-- جدول الملخص الإداري
ALTER TABLE public.administrative_summary
ADD COLUMN IF NOT EXISTS last_modified_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
ADD COLUMN IF NOT EXISTS last_modified_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS last_modified_by_name text;

-- جدول السجلات السنوية
ALTER TABLE public.yearly_records
ADD COLUMN IF NOT EXISTS last_modified_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
ADD COLUMN IF NOT EXISTS last_modified_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS last_modified_by_name text;

-- جدول التفاصيل (لجان، شكر، عقوبات، إجازات)
ALTER TABLE public.thanks_details ADD COLUMN IF NOT EXISTS last_modified_at timestamp with time zone, ADD COLUMN IF NOT EXISTS last_modified_by uuid, ADD COLUMN IF NOT EXISTS last_modified_by_name text;
ALTER TABLE public.committees_details ADD COLUMN IF NOT EXISTS last_modified_at timestamp with time zone, ADD COLUMN IF NOT EXISTS last_modified_by uuid, ADD COLUMN IF NOT EXISTS last_modified_by_name text;
ALTER TABLE public.penalties_details ADD COLUMN IF NOT EXISTS last_modified_at timestamp with time zone, ADD COLUMN IF NOT EXISTS last_modified_by uuid, ADD COLUMN IF NOT EXISTS last_modified_by_name text;
ALTER TABLE public.leaves_details ADD COLUMN IF NOT EXISTS last_modified_at timestamp with time zone, ADD COLUMN IF NOT EXISTS last_modified_by uuid, ADD COLUMN IF NOT EXISTS last_modified_by_name text;

-- 2. إصلاح جدول سجلات الدخول (login_logs)
-- المشكلة: خطأ 409 يعني وجود قيد يمنع التكرار (غالباً على user_id).
-- الحل: حذف القيد للسماح بتعدد السجلات للمستخدم الواحد.

-- نحاول حذف القيد المتوقع (بناءً على التسمية الافتراضية)
ALTER TABLE public.login_logs DROP CONSTRAINT IF EXISTS login_logs_user_id_key;
ALTER TABLE public.login_logs DROP CONSTRAINT IF EXISTS login_logs_pkey; -- In case ID is manually set and duplicated (unlikely with auto-gen)

-- التأكد من وجود مفتاح أساسي تلقائي
ALTER TABLE public.login_logs 
ADD COLUMN IF NOT EXISTS log_id uuid DEFAULT gen_random_uuid() PRIMARY KEY;

-- ملاحظة: إذا كان الجدول مصمم ليكون "آخر دخول فقط"، فالأفضل استخدام Upsert في الكود، 
-- لكن السياق يشير إلى أنه "سجل" (Logs)، لذا يجب السماح بالتكرار.
