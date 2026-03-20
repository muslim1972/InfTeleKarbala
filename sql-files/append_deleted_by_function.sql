-- دالة RPC لإضافة user_id إلى مصفوفة deleted_by في جدول messages
-- يجب تنفيذ هذا السكربت في Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.append_deleted_by(p_message_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.messages
  SET deleted_by = array_append(COALESCE(deleted_by, '{}'), p_user_id)
  WHERE id = p_message_id
    AND NOT (p_user_id = ANY(COALESCE(deleted_by, '{}')));
END;
$$;
