-- إنشاء جدول المحادثات
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    is_group BOOLEAN DEFAULT false,
    participants JSONB DEFAULT '[]'::jsonb, -- مصفوفة لمعرفات المستخدمين
    last_message TEXT,
    last_message_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- تفعيل RLS لجدول المحادثات
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- سياسة المشاهدة: المستخدم يرى المحادثات التي هو جزء منها
CREATE POLICY "Users can view conversations they are part of" ON public.conversations
    FOR SELECT USING (auth.uid()::text IN (
        SELECT jsonb_array_elements_text(participants)
    ));

-- سياسة التعديل: لتحديث "آخر رسالة" عند الإرسال
CREATE POLICY "Users can update conversations they are part of" ON public.conversations
    FOR UPDATE USING (auth.uid()::text IN (
        SELECT jsonb_array_elements_text(participants)
    ));

-- سياسة الإضافة: السماح للمستخدمين بإنشاء محادثات (يمكن تقييدها لاحقاً)
CREATE POLICY "Users can insert conversations" ON public.conversations
    FOR INSERT WITH CHECK (true);


-- إنشاء جدول الرسائل (نصوص فقط)
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    text TEXT NOT NULL, -- النص أساسي وإلزامي
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- تفعيل RLS لجدول الرسائل
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- سياسة المشاهدة: رؤية رسائل المحادثات المشترك فيها
CREATE POLICY "Users can view messages in their conversations" ON public.messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = conversation_id
            AND auth.uid()::text IN (SELECT jsonb_array_elements_text(c.participants))
        )
    );

-- سياسة الإضافة: إرسال رسائل للمحادثات المشترك فيها
CREATE POLICY "Users can insert messages in their conversations" ON public.messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = conversation_id
            AND auth.uid()::text IN (SELECT jsonb_array_elements_text(c.participants))
        )
    );

-- فهارس للأداء
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_participants ON public.conversations USING GIN (participants);
