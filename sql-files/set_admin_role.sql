
-- 🛠️ تعيين الـ Admin يدوياً
-- استبدل الرقم '263538' بالرقم الوظيفي الخاص بك
UPDATE public.profiles
SET role = 'admin'
WHERE job_number = '263538'; -- ضع رقمك الوظيفي هنا

-- التحقق من النتيجة
SELECT full_name, job_number, role FROM public.profiles WHERE role = 'admin';
