import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { v4 as uuidv4 } from 'uuid';

/**
 * Sends a push notification via our serverless relay
 */
async function sendPushNotification(recipientId: string, title: string, message: string, conversationId: string) {
    // Skip on localhost to avoid 404 errors as the API relay is only on Vercel
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('Skipping push notification on localhost');
        return;
    }
    try {
        await fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipientId,
                title,
                message,
                url: `${window.location.origin}/chat/${conversationId}`,
                data: { conversationId }
            })
        });
    } catch (error) {
        console.error('Failed to send push notification:', error);
    }
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string;
  audio_url?: string;
  read_by?: string[];
  reactions?: Record<string, string>; // { user_id: emoji }
  created_at: string;
  is_sending?: boolean; // Optimistic UI
  sender?: {
    full_name: string;
  };
}

export function useChatState(conversationId: string) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select('*, read_by, sender:profiles!messages_sender_id_fkey(full_name)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      toast.error('فشل تحميل الرسائل');
    } else {
      setMessages(data || []);

      // Mark unread messages as read for this user
      if (user && data && data.length > 0) {
        const unreadIds = data
          .filter(m => m.sender_id !== user.id && (!m.read_by || !m.read_by.includes(user.id)))
          .map(m => m.id);

        if (unreadIds.length > 0) {
          supabase
            .rpc('mark_chat_read', { p_conversation_id: conversationId })
            .then(({ error: updateErr }) => {
              if (updateErr) {
                console.error('Error marking as read:', updateErr);
              } else {
                // Trigger global event immediately, AppNotifications will handle the "immunity"
                window.dispatchEvent(new CustomEvent('chat_read', {
                  detail: { conversationId }
                }));
              }
            });
        }
      }
    }
    setLoading(false);
  }, [conversationId, user]);

  // Stable ref for fetchMessages to avoid recreating the channel on every render
  const fetchMessagesRef = useRef(fetchMessages);
  fetchMessagesRef.current = fetchMessages;

  // Subscribe to real-time changes
  useEffect(() => {
    if (!conversationId) return;

    // Use the ref so this effect only depends on conversationId
    fetchMessagesRef.current();

    // Create channel
    const channel = supabase.channel(`chat:${conversationId}`);

    // Subscribe
    channel
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, DELETE, UPDATE)
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as Message;

            // Fetch sender profile since Realtime payload doesn't include joined tables
            const processNewMessage = (msg: Message) => {
              // 1. Add it immediately so the UI responds instantly in Realtime
              setMessages(prev => {
                const exists = prev.find(m => m.id === msg.id);
                if (exists) return prev.map(m => m.id === msg.id ? { ...msg, is_sending: false } : m);
                return [...prev, msg];
              });

              // 2. Fetch sender name async and update it in place
              if (msg.sender_id && !msg.sender) {
                supabase
                  .from('profiles')
                  .select('full_name')
                  .eq('id', msg.sender_id)
                  .single()
                  .then(({ data }) => {
                    if (data) {
                      setMessages(current =>
                        current.map(m => m.id === msg.id ? { ...m, sender: { full_name: data.full_name } } : m)
                      );
                    }
                  });
              }
            };

            processNewMessage(newMsg);

            // If the incoming message is from someone else, mark it read immediately because we are viewing the chat
            if (user && newMsg.sender_id !== user.id && (!newMsg.read_by || !newMsg.read_by.includes(user.id))) {
              supabase
                .rpc('mark_chat_read', { p_conversation_id: conversationId })
                .then(({ error: updateErr }) => {
                  if (!updateErr) {
                    window.dispatchEvent(new CustomEvent('chat_read', {
                      detail: { conversationId }
                    }));
                  }
                });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedMsg = payload.new as Message;
            setMessages(prev => prev.map(m => m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m));
          } else if (payload.eventType === 'DELETE') {
            const deletedMsg = payload.old as { id: string };
            setMessages(prev => prev.filter(m => m.id !== deletedMsg.id));
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Subscribed to chat changes');
        }
      });

    // Cleanup
    return () => {
      // Small check to ensure we only remove if it's not already closed
      if (channel) {
        supabase.removeChannel(channel).catch(() => { });
      }
    };
  }, [conversationId, user]);

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newMessage.trim() || !user || !conversationId) return;

    const text = newMessage.trim();
    setNewMessage('');
    setIsSending(true);

    // Optimistic Update
    const optimisticId = uuidv4();
    const optimisticMsg: Message = {
      id: optimisticId,
      conversation_id: conversationId,
      sender_id: user.id,
      text: text,
      created_at: new Date().toISOString(),
      is_sending: true
    };

    setMessages(prev => [...prev, optimisticMsg]);

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          id: optimisticId,
          conversation_id: conversationId,
          sender_id: user.id,
          text: text
        });

      if (error) throw error;

      // 3. Update conversation last_message and clear deleted_by so it revives for others
      await supabase
        .from('conversations')
        .update({
          last_message: text,
          last_message_at: new Date().toISOString(),
          deleted_by: []
        })
        .eq('id', conversationId);

      // 4. IMPORTANT: Clear sending state IMMEDIATELY so UI is responsive
      setIsSending(false);

      // 5. Send Push Notification to recipients (Fire and forget in background)
      (async () => {
        try {
          const { data: convData } = await supabase
            .from('conversations')
            .select('participants')
            .eq('id', conversationId)
            .single();

          if (convData?.participants) {
            const recipients = (convData.participants as string[]).filter(id => id !== user.id);
            recipients.forEach(recipientId => {
              sendPushNotification(recipientId, user.full_name, text, conversationId);
            });
          }
        } catch (err) {
          console.error('Background notification error:', err);
        }
      })();

    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('فشل إرسال الرسالة');
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
      setNewMessage(text); // Restore text
      setIsSending(false); // Ensure cleared
    }
  };

  // Voice Message Sending
  const sendVoiceMessage = async (audioBlob: Blob) => {
    if (!user || !conversationId) return;
    setIsSending(true);

    const optimisticId = uuidv4();
    const ext = audioBlob.type.includes('webm') ? 'webm' : 'mp4';
    const filePath = `${user.id}/${optimisticId}.${ext}`;

    // Optimistic message
    const optimisticMsg: Message = {
      id: optimisticId,
      conversation_id: conversationId,
      sender_id: user.id,
      text: '🎤 رسالة صوتية',
      created_at: new Date().toISOString(),
      is_sending: true,
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      // 1. Upload to storage
      console.log(`Uploading voice: ${filePath}, size: ${audioBlob.size}, type: ${audioBlob.type}`);
      const { error: uploadError } = await supabase.storage
        .from('voice-messages')
        .upload(filePath, audioBlob, {
          contentType: audioBlob.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // 2. Get public URL
      const { data: urlData } = supabase.storage
        .from('voice-messages')
        .getPublicUrl(filePath);

      const audioUrl = urlData.publicUrl;
      console.log('Voice URL:', audioUrl);

      // 3. Insert message with audio_url
      const { error: insertError } = await supabase
        .from('messages')
        .insert({
          id: optimisticId,
          conversation_id: conversationId,
          sender_id: user.id,
          text: '🎤 رسالة صوتية',
          audio_url: audioUrl,
        });

      if (insertError) throw insertError;

      // 4. Immediately update the optimistic message with audio_url so the player renders
      setMessages(prev => prev.map(m =>
        m.id === optimisticId
          ? { ...m, audio_url: audioUrl, is_sending: false }
          : m
      ));

      // 5. Update conversation
      await supabase
        .from('conversations')
        .update({
          last_message: '🎤 رسالة صوتية',
          last_message_at: new Date().toISOString(),
          deleted_by: [],
        })
        .eq('id', conversationId);

      // 6. Send Push Notification to recipients
      const { data: convData } = await supabase
        .from('conversations')
        .select('participants')
        .eq('id', conversationId)
        .single();

      if (convData?.participants) {
        const recipients = (convData.participants as string[]).filter(id => id !== user.id);
        for (const recipientId of recipients) {
            sendPushNotification(recipientId, user.full_name, '🎤 رسالة صوتية', conversationId);
        }
      }

    } catch (error) {
      console.error('Error sending voice message:', error);
      toast.error('فشل إرسال الرسالة الصوتية');
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
      // Cleanup uploaded file on failure
      supabase.storage.from('voice-messages').remove([filePath]).catch(() => {});
    } finally {
      setIsSending(false);
    }
  };

  // Selection Logic
  const [selectedMessages, setSelectedMessages] = useState<string[]>([]);

  const toggleSelection = useCallback((messageId: string) => {
    setSelectedMessages(prev =>
      prev.includes(messageId)
        ? prev.filter(id => id !== messageId)
        : [...prev, messageId]
    );
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedMessages([]);
  }, []);

  const deleteMessages = async () => {
    if (selectedMessages.length === 0) return;

    const toastId = toast.loading('جاري الحذف...');
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .in('id', selectedMessages);

      if (error) throw error;

      // Optimistic delete
      setMessages(prev => prev.filter(m => !selectedMessages.includes(m.id)));
      clearSelection();
      toast.success('تم الحذف بنجاح', { id: toastId });
    } catch (error) {
      console.error('Error deleting messages:', error);
      toast.error('فشل الحذف', { id: toastId });
    }
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;

    // Optimistic Update
    setMessages(prev => prev.map(m => {
      if (m.id === messageId) {
        const reactions = { ...(m.reactions || {}) };
        if (reactions[user.id] === emoji) {
          delete reactions[user.id];
        } else {
          reactions[user.id] = emoji;
        }
        return { ...m, reactions };
      }
      return m;
    }));

    try {
      const { error } = await supabase.rpc('rpc_toggle_message_reaction', {
        p_message_id: messageId,
        p_emoji: emoji
      });
      if (error) throw error;
    } catch (error) {
      console.error('Error toggling reaction:', error);
      toast.error('فشل تحديث التفاعل');
      // Refetch messages to get clean state on failure
      fetchMessages();
    }
  };

  return {
    messages,
    loading,
    newMessage,
    setNewMessage,
    isSending,
    sendMessage,
    sendVoiceMessage,
    selectedMessages,
    toggleSelection,
    clearSelection,
    deleteMessages,
    toggleReaction
  };
}
