-- إضافة الأعمدة الجديدة المطلوبة لنظام البصمة الموحد وتصنيف البصمات (حتى 6 بصمات)
ALTER TABLE public.attendance_records 
ADD COLUMN IF NOT EXISTS raw_punches JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.attendance_records 
ADD COLUMN IF NOT EXISTS time_leave_out_2 TIMESTAMPTZ;

ALTER TABLE public.attendance_records 
ADD COLUMN IF NOT EXISTS time_leave_return_2 TIMESTAMPTZ;

-- تعليق: يجب تشغيل هذا السكربت في واجهة Supabase SQL Editor.
