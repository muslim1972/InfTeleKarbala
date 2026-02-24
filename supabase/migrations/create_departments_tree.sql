-- 1. أولاً نقوم بإنشاء جدول التشكيلات الإدارية (الشجرة)
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL, -- اسم القسم/الشعبة
    level INTEGER NOT NULL, -- المستوى الإداري (1: مدير، 2: معاون، 3: أقسام ومجمعات، 4: شعب)
    parent_id UUID REFERENCES public.departments(id) ON DELETE SET NULL, -- ارتباط التشكيل بالمرجع الأعلى
    manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- ارتباط التشكيل بحساب المسؤول (المدير/المسؤول)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

-- 2. نقوم بحذف الأعمدة النصية القديمة التي أضفناها سابقاً (الخطة الملغاة)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS department;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS management_position;

-- 3. نضيف العمود الوحيد المطلوب لربط الموظف بالهيكلية الشجرية
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

-- 4. إعداد الصلاحيات (RLS) لجدول التشكيلات
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- الجميع يستطيع رؤية الهيكلية (مهمة لعرضها للموظفين ولمعرفة مرجعياتهم)
CREATE POLICY "Everyone can view departments" ON public.departments
    FOR SELECT USING (true);

-- فقط الآدمن من حقهم التعديل على الهيكلية الإدارية
CREATE POLICY "Admins can manage departments" ON public.departments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );
