-- 1. Add read_by to messages to track who read a message
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_by UUID[] DEFAULT '{}'::uuid[];

-- Migrate old read messages to be "read by everyone" to prevent them from bubbling up again
UPDATE messages SET read_by = ARRAY(SELECT id FROM profiles) WHERE is_read = true AND read_by = '{}'::uuid[];

-- 2. Add deleted_by to conversations to track who deleted a chat
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deleted_by UUID[] DEFAULT '{}'::uuid[];

-- 3. Update the mark_chat_read Function
CREATE OR REPLACE FUNCTION mark_chat_read(p_conversation_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE messages 
    SET read_by = array_append(COALESCE(read_by, '{}'::uuid[]), auth.uid()) 
    WHERE conversation_id = p_conversation_id 
    AND sender_id != auth.uid()
    AND NOT (auth.uid() = ANY(COALESCE(read_by, '{}'::uuid[])));
END;
$$;

-- 4. Update the delete_chat_conversation Function
CREATE OR REPLACE FUNCTION delete_chat_conversation(p_conversation_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Instead of DELETING the row, we just mark it as deleted for the calling user
    UPDATE conversations 
    SET deleted_by = array_append(COALESCE(deleted_by, '{}'::uuid[]), auth.uid()) 
    WHERE id = p_conversation_id
    AND NOT (auth.uid() = ANY(COALESCE(deleted_by, '{}'::uuid[])));
END;
$$;
