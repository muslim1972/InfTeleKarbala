-- 1. إزالة دالة التخطي والـ View القديم لإنهاء تحذير UNRESTRICTED
DROP VIEW IF EXISTS public.available_profiles CASCADE;
DROP FUNCTION IF EXISTS public.get_available_profiles() CASCADE;

-- 2. إنشاء الجدول الحقيقي (الآمن) بنفس الأعمدة السابقة
CREATE TABLE public.available_profiles (
    id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    full_name text,
    avatar_url text,
    dept_text text,
    job_number text,
    username text,
    role text,
    admin_role text,
    department_id uuid,
    section_text text,
    unit_text text,
    governorate text
);

-- 3. تفعيل RLS صريح على الجدول الجديد لإرضاء لجنة الأمن السيبراني
ALTER TABLE public.available_profiles ENABLE ROW LEVEL SECURITY;

-- السماح للمسجلين الدخول فقط (Authenticated) بقراءة البيانات الآمنة (هذا يبقي سلسلة المراجع تعمل)
CREATE POLICY "Allow authenticated to read available_profiles"
ON public.available_profiles FOR SELECT
TO authenticated
USING (true);

-- 4. تعبئة الجدول بالبيانات الحالية الموجودة في النظام لكي لا يتوقف أي شيء
INSERT INTO public.available_profiles (
    id, full_name, avatar_url, dept_text, job_number, username, 
    role, admin_role, department_id, section_text, unit_text, governorate
)
SELECT 
    id, full_name, avatar_url, dept_text, job_number, username, 
    role, admin_role, department_id, section_text, unit_text, governorate
FROM public.profiles;

-- 5. دالة المزامنة: لضمان التحديث الفوري لأي موظف جديد أو تعديل دون تدخل يدوي
CREATE OR REPLACE FUNCTION public.sync_available_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.available_profiles (
            id, full_name, avatar_url, dept_text, job_number, username, 
            role, admin_role, department_id, section_text, unit_text, governorate
        ) VALUES (
            NEW.id, NEW.full_name, NEW.avatar_url, NEW.dept_text, NEW.job_number, NEW.username, 
            NEW.role, NEW.admin_role, NEW.department_id, NEW.section_text, NEW.unit_text, NEW.governorate
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE public.available_profiles
        SET 
            full_name = NEW.full_name,
            avatar_url = NEW.avatar_url,
            dept_text = NEW.dept_text,
            job_number = NEW.job_number,
            username = NEW.username,
            role = NEW.role,
            admin_role = NEW.admin_role,
            department_id = NEW.department_id,
            section_text = NEW.section_text,
            unit_text = NEW.unit_text,
            governorate = NEW.governorate
        WHERE id = NEW.id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM public.available_profiles WHERE id = OLD.id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

-- 6. إنشاء الـ Trigger ليعمل فورا وبشكل تلقائي بعد أي عملية على جدول profiles
DROP TRIGGER IF EXISTS trg_sync_available_profiles ON public.profiles;
CREATE TRIGGER trg_sync_available_profiles
AFTER INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_available_profiles();
