-- 1. إضافة حقل deleted_by لجدول الرسائل إذا لم يكن موجوداً
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted_by UUID[] DEFAULT '{}'::uuid[];

-- 2. تصحيح دالة مسح المحادثة لتحديث الطرفين (المحادثة نفسها ورسائلها الحالية المتواجدة لحظة الحذف)
CREATE OR REPLACE FUNCTION delete_chat_conversation(p_conversation_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- أ. إضافة المستخدم لمصفوفة الحذف على مستوى المحادثة
    UPDATE public.conversations 
    SET deleted_by = array_append(COALESCE(deleted_by, '{}'::uuid[]), auth.uid())
    WHERE id = p_conversation_id 
    AND NOT (auth.uid() = ANY(COALESCE(deleted_by, '{}'::uuid[])));

    -- ب. إضافة المستخدم لمصفوفة الحذف على مستوى كل رسالة موجودة حالياً في المحادثة
    UPDATE public.messages 
    SET deleted_by = array_append(COALESCE(deleted_by, '{}'::uuid[]), auth.uid())
    WHERE conversation_id = p_conversation_id 
    AND NOT (auth.uid() = ANY(COALESCE(deleted_by, '{}'::uuid[])));
END;
$$;
