BEGIN;

-- 1. حذف النسخة غير النشطة التي أُنشئت قبل حقن الرواتب
DELETE FROM public.monthly_snapshots 
WHERE id = '428df91f-f09c-401e-8c8e-fcf8988300cb' 
  AND name = 'شهر تشرين الأول العاشر 2026'
  AND governorate = 'karbala'
  AND is_active = false;

-- 2. تعديل اسم النسخة النشطة المحقونة برواتب شهر 10 الحقيقية لتكون شهر تشرين الأول العاشر 2026
UPDATE public.monthly_snapshots 
SET name = 'شهر تشرين الأول العاشر 2026'
WHERE id = '7190d11d-229e-4a37-a303-085d2b82ff34'
  AND governorate = 'karbala'
  AND is_active = true;

COMMIT;

-- فحص النتيجة بعد التصحيح
SELECT id, name, is_active, financial_count, profile_count, governorate, created_at 
FROM public.monthly_snapshots 
WHERE governorate = 'karbala'
ORDER BY created_at DESC;
