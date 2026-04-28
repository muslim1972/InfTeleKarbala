-- إضافة أعمدة 2FA وتحديث الإيميل في جدول profiles
BEGIN;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS two_factor_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS two_factor_code text,
ADD COLUMN IF NOT EXISTS two_factor_expires_at timestamp with time zone;

COMMIT;
