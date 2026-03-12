-- إضافة عمود التفاعلات لجدول الرسائل
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb;

-- إضافة وظيفة لتحديث التفاعل (أو إزالته إذا تم اختيار نفس الرمز)
CREATE OR REPLACE FUNCTION public.rpc_toggle_message_reaction(
    p_message_id UUID,
    p_emoji TEXT
)
RETURNS VOID AS $$
DECLARE
    v_user_id TEXT := auth.uid()::text;
    v_current_reactions JSONB;
BEGIN
    -- الحصول على التفاعلات الحالية
    SELECT reactions INTO v_current_reactions FROM public.messages WHERE id = p_message_id;
    
    -- إذا كان المستخدم قد تفاعل بنفس الرمز، نقوم بإزالته
    IF v_current_reactions ? v_user_id AND v_current_reactions->>v_user_id = p_emoji THEN
        UPDATE public.messages
        SET reactions = reactions - v_user_id
        WHERE id = p_message_id;
    ELSE
        -- وإلا نقوم بإضافة أو تحديث التفاعل
        UPDATE public.messages
        SET reactions = reactions || jsonb_build_object(v_user_id, p_emoji)
        WHERE id = p_message_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
