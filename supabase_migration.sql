-- 1. تحديث جدول الطلبة (حذف الأعمدة القديمة وإضافة الجديدة)
ALTER TABLE public.summer_training_students
  DROP CONSTRAINT IF EXISTS summer_training_students_institution_type_check;

ALTER TABLE public.summer_training_students
  DROP COLUMN IF EXISTS institution_type,
  DROP COLUMN IF EXISTS department,
  DROP COLUMN IF EXISTS start_date,
  DROP COLUMN IF EXISTS end_date;

ALTER TABLE public.summer_training_students
  ADD COLUMN IF NOT EXISTS training_location text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS trainer_name text NOT NULL DEFAULT '';

-- 2. تحديث جدول إعدادات التدريب الصيفي
ALTER TABLE public.summer_training_settings
  ADD COLUMN IF NOT EXISTS training_year text NULL DEFAULT '2026',
  ADD COLUMN IF NOT EXISTS training_start_date date NULL DEFAULT '2026-07-05',
  ADD COLUMN IF NOT EXISTS training_end_date date NULL DEFAULT '2026-08-05';

-- 3. تحديث دالة إضافة طالب جديد لتشمل الحقول الجديدة
-- أولاً نحذف الدالة القديمة لأن المعاملات (Parameters) ستتغير
DROP FUNCTION IF EXISTS public.create_training_student(text, text, text, text, text, text, date, date, uuid);

-- ثانياً ننشئ الدالة الجديدة
CREATE OR REPLACE FUNCTION public.create_training_student(
    p_full_name text,
    p_username text,
    p_password text,
    p_institution_name text,
    p_training_location text,
    p_trainer_name text,
    p_supervisor_id uuid
) RETURNS void AS $$
BEGIN
    INSERT INTO public.summer_training_students (
        full_name,
        username,
        password_hash,
        institution_name,
        training_location,
        trainer_name,
        supervisor_id
    ) VALUES (
        p_full_name,
        p_username,
        crypt(p_password, gen_salt('bf')),
        p_institution_name,
        p_training_location,
        p_trainer_name,
        p_supervisor_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
