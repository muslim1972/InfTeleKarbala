-- إضافة أعمدة البيانات الشخصية والاجتماعية الجديدة لجدول profiles
-- B.R.I.C.K Kernel: BE-HR-01 / BE-CORE-03

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mother_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS general_specialization text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS position_title text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reinstatement_date text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS leave_date text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reinstatement_type text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number text;

-- إشعار PostgREST بتحديث الكاش للمخطط الحي
NOTIFY pgrst, 'reload schema';
