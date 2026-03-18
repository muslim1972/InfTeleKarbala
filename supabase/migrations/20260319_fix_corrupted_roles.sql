-- 1. أولاً نقوم بإعادة الجميع إلى موظف عادي
-- سيشمل هذا الـ 338 من الذين حصلوا على مطور بالخطأ
-- سنقوم أيضاً بتصفير supervisor_level المرتبط بالصلاحيات
UPDATE public.profiles 
SET admin_role = NULL,
    supervisor_level = 0
WHERE admin_role IS NOT NULL OR supervisor_level > 0;

-- 2. إعادة صلاحية المطور لك فقط (مسلم)
UPDATE public.profiles 
SET admin_role = 'developer',
    supervisor_level = 4
WHERE full_name LIKE '%مسلم عقيل%';

-- 3. إعادة صلاحية الموارد البشرية (الذاتية) لأسيل
UPDATE public.profiles 
SET admin_role = 'hr',
    supervisor_level = 3
WHERE full_name LIKE '%اسيل%';

-- 4. إعادة صلاحية الإعلام لميسون
UPDATE public.profiles 
SET admin_role = 'media',
    supervisor_level = 2
WHERE full_name LIKE '%ميسون%';

-- 5. ملاحظة: بالنسبة لقسم المالية والمدراء، يمكنك إسنادهم يدوياً من واجهة لوحة التحكم الخاصة بك.
