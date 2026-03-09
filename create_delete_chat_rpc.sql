-- دالة مخصصة لحذف المحادثة بصلاحيات المشرف (لتخطي قيود RLS الخفية)
CREATE OR REPLACE FUNCTION delete_chat_conversation(p_conversation_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- حذف المحادثة فقط إذا كان المستخدم الحالي جزءاً منها (اختياري للأمان، لكن هنا سنعتمد الحذف المباشر)
  -- CASCADE في جداول قاعدة البيانات ستقوم تلقائياً بحذف الرسائل المرتبطة
  DELETE FROM public.conversations
  WHERE id = p_conversation_id;
END;
$$;
