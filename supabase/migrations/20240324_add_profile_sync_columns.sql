-- إضافة أعمدة جديدة لجدول profiles لدعم تحديث المعلومات الأساسية من Excel
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS graduation_year text,
  ADD COLUMN IF NOT EXISTS work_nature text,
  ADD COLUMN IF NOT EXISTS appointment_date text,
  ADD COLUMN IF NOT EXISTS specialization text,
  ADD COLUMN IF NOT EXISTS dept_text text,
  ADD COLUMN IF NOT EXISTS section_text text,
  ADD COLUMN IF NOT EXISTS unit_text text;

-- إضافة تعليقات للأعمدة لتوضيح محتواها
COMMENT ON COLUMN public.profiles.graduation_year IS 'سنة التخرج';
COMMENT ON COLUMN public.profiles.work_nature IS 'طبيعة العمل (هندسي، فني، إداري، إلخ)';
COMMENT ON COLUMN public.profiles.appointment_date IS 'تاريخ التعيين';
COMMENT ON COLUMN public.profiles.specialization IS 'التخصص (PROF)';
COMMENT ON COLUMN public.profiles.dept_text IS 'اسم القسم (نصي من Excel)';
COMMENT ON COLUMN public.profiles.section_text IS 'اسم الشعبة (نصي من Excel)';
COMMENT ON COLUMN public.profiles.unit_text IS 'اسم الوحدة (نصي من Excel)';
