-- تشغيل هذا الكود في قسم SQL Editor في لوحة التحكم (Supabase)

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS department VARCHAR(255),
ADD COLUMN IF NOT EXISTS management_position VARCHAR(255);
