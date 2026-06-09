-- هذا السكربت يقوم بمسح "جميع" السياسات السابقة (التي كانت تسمح للزوار بالقراءة)
-- ثم يقوم بإنشاء سياسة واحدة آمنة ومغلقة للمستخدمين المسجلين فقط

DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    -- مسح كل السياسات من summer_training_settings
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'summer_training_settings' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.summer_training_settings', r.policyname);
    END LOOP;

    -- مسح كل السياسات من summer_training_students
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'summer_training_students' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.summer_training_students', r.policyname);
    END LOOP;

    -- مسح كل السياسات من summer_training_results
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'summer_training_results' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.summer_training_results', r.policyname);
    END LOOP;
    
    -- مسح كل السياسات من admin_tips
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'admin_tips' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.admin_tips', r.policyname);
    END LOOP;
END $$;

-- بعد مسح القديم، نقوم بتفعيل RLS وإنشاء سياسة نظيفة وآمنة
ALTER TABLE public.summer_training_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for authenticated users only" ON public.summer_training_settings FOR SELECT TO authenticated USING (true);

ALTER TABLE public.summer_training_students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for authenticated users only" ON public.summer_training_students FOR SELECT TO authenticated USING (true);

ALTER TABLE public.summer_training_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for authenticated users only" ON public.summer_training_results FOR SELECT TO authenticated USING (true);

ALTER TABLE public.admin_tips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for authenticated users only" ON public.admin_tips FOR SELECT TO authenticated USING (true);
