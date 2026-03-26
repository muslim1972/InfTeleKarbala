-- إضافة عمود عداد التنبيهات العاجلة لجدول الرسائل
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS buzz_count INT DEFAULT 1;
