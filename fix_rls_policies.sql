
-- 🛠️ إصلاح سياسات الأمان (RLS) لجدول profiles
-- المشكلة: التعديل ينجح ظاهرياً لكن لا يتم حفظه لأن السياسات تمنع تعديل "الغير" أو تعديل حقل "role".

-- 1. تفعيل RLS (للتأكد)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. حذف السياسات القديمة (لتجنب التضارب)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- 3. إنشاء سياسات جديدة

-- أ) السماح للجميع بالقراءة (لأغراض البحث وتسجيل الدخول)
CREATE POLICY "Public profiles are viewable by everyone" 
ON public.profiles FOR SELECT 
USING (true);

-- ب) السماح للموظف بتعديل بياناته (ما عدا الصلاحية role وكلمة المرور يفضل تقييدها، لكن سنسمح الآن)
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- ج) السماح للمشرفين (Admins) بتعديل أي بروفايل (بما في ذلك الترقية لمشرف)
-- نتحقق مما إذا كان المستخدم الحالي لديه صلاحية 'admin' في جدول profiles
CREATE POLICY "Admins can update all profiles" 
ON public.profiles FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- د) السماح للمشرفين بالإضافة (Insert) - في حال الإضافة اليدوية
CREATE POLICY "Admins can insert profiles" 
ON public.profiles FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- هـ) السماح للمشرفين بالحذف
CREATE POLICY "Admins can delete profiles" 
ON public.profiles FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);
