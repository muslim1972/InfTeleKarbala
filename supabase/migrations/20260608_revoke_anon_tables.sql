-- تفعيل RLS على جدول قيمة النقطة لمنع الزوار المجهولين (anon) من قراءتها
ALTER TABLE public.incentive_point_values ENABLE ROW LEVEL SECURITY;

-- إزالة أي سياسة تسمح للـ anon بالقراءة إن وجدت
DROP POLICY IF EXISTS "Allow public read access" ON public.incentive_point_values;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.incentive_point_values;

-- إنشاء سياسة تسمح فقط للمستخدمين المسجلين (authenticated) بقراءة قيمة النقطة
CREATE POLICY "Allow authenticated read access" 
ON public.incentive_point_values 
FOR SELECT 
TO authenticated 
USING (true);

-- (اختياري) إذا كنت تريد إغلاق تبويبة الإعلام والاستطلاعات عن الزوار المجهولين أيضاً
ALTER TABLE public.media_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;

-- السماح للمسجلين فقط بقراءة الإعلام والاستطلاعات
CREATE POLICY "Allow authenticated read media" ON public.media_content FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read polls" ON public.polls FOR SELECT TO authenticated USING (true);
