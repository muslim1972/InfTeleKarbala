-- 1. التأكد من أن سياسة التحديث (UPDATE) مسموحة للمستخدم على رسائله الخاصة
-- ملاحظة: قد تكون السياسة الحالية تسمح فقط بالحذف، سنضيف سياسة للتحديث
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'messages' AND policyname = 'Users can update their own buzz messages'
    ) THEN
        CREATE POLICY "Users can update their own buzz messages" 
        ON public.messages 
        FOR UPDATE 
        USING (auth.uid() = sender_id)
        WITH CHECK (auth.uid() = sender_id);
    END IF;
END $$;

-- 2. تفعيل المزامنة الفورية لكل الأعمدة (لضمان وصول العداد للطرف الآخر)
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- 3. تصفير العداد للرسائل الحالية للتأكد من نظافة البيانات
UPDATE public.messages SET buzz_count = 1 WHERE buzz_count IS NULL;
