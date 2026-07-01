-- =============================================
-- إضافة أوقات الدوام لمواقع العمل
-- =============================================

ALTER TABLE public.work_location_employees
ADD COLUMN IF NOT EXISTS shift_start TIME,
ADD COLUMN IF NOT EXISTS shift_end TIME;

-- تعليقات توضيحية
COMMENT ON COLUMN public.work_location_employees.shift_start IS 'وقت بداية دوام الموظف في هذا الموقع';
COMMENT ON COLUMN public.work_location_employees.shift_end IS 'وقت نهاية دوام الموظف في هذا الموقع';
