-- Create a SECURITY DEFINER function to bypass Row Level Security 
-- so a recipient can mark a sender's messages as read.
CREATE OR REPLACE FUNCTION mark_chat_read(p_conversation_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Mark all messages as read in this conversation that belong to other senders
  UPDATE public.messages
  SET is_read = true
  WHERE conversation_id = p_conversation_id
    AND sender_id != auth.uid()
    AND is_read = false;
END;
$$;
