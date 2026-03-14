-- تحديث دالة حذف المحادثة لتكون غير تدميرية وتدعم مغادرة المجموعات
-- يرجى تشغيل هذا الكود في Supabase SQL Editor

CREATE OR REPLACE FUNCTION delete_chat_conversation(p_conversation_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_group BOOLEAN;
BEGIN
    -- 1. التحقق مما إذا كانت المحادثة مجموعة أم لا
    SELECT is_group INTO v_is_group 
    FROM public.conversations 
    WHERE id = p_conversation_id;

    IF v_is_group THEN
        -- 2. إذا كانت مجموعة: قم بإزالة المستخدم من قائمة المشاركين (مغادرة المجموعة)
        -- نستخدم معامل الـ - للحذف من مصفوفة jsonb
        UPDATE public.conversations
        SET participants = participants - (auth.uid())::text
        WHERE id = p_conversation_id;
    ELSE
        -- 3. إذا كانت محادثة خاصة: أضف المستخدم إلى قائمة deleted_by (إخفاء المحادثة)
        UPDATE public.conversations
        SET deleted_by = array_append(COALESCE(deleted_by, '{}'::uuid[]), auth.uid())
        WHERE id = p_conversation_id;
    END IF;

    -- ملاحظة: إذا أصبح عدد المشاركين 0 أو 1 في محادثة خاصة وتم حذفها من الطرفين، 
    -- يمكن لاحقاً إضافة منطق تنظيف (Cleanup) إذا لزم الأمر، لكن حالياً هذا هو السلوك الآمن.
END;
$$;
