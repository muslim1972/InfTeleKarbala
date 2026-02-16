-- Secure RPC to get or create supervisors group
CREATE OR REPLACE FUNCTION public.get_or_create_supervisors_chat()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    group_id UUID;
    current_user_id TEXT;
    group_record RECORD;
BEGIN
    current_user_id := auth.uid()::text;
    
    -- 1. Try to find the group (ignoring RLS)
    SELECT id, participants INTO group_record
    FROM public.conversations
    WHERE name = 'مجموعة المشرفين' AND is_group = true
    LIMIT 1;

    IF group_record.id IS NOT NULL THEN
        group_id := group_record.id;
        
        -- 2. Ensure user is in participants
        IF NOT (group_record.participants @> to_jsonb(current_user_id)) THEN
            UPDATE public.conversations
            SET participants = participants || to_jsonb(current_user_id)
            WHERE id = group_id;
        END IF;
    ELSE
        -- 3. Create if not exists
        INSERT INTO public.conversations (name, is_group, participants)
        VALUES ('مجموعة المشرفين', true, jsonb_build_array(current_user_id))
        RETURNING id INTO group_id;
    END IF;

    -- Return basic group info
    RETURN jsonb_build_object('id', group_id);
END;
$$;
