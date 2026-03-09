import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { v4 as uuidv4 } from 'uuid';

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string;
  is_read: boolean;
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
      .select('*, sender:profiles!messages_sender_id_fkey(full_name)')
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
          .filter(m => !m.is_read && m.sender_id !== user.id)
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

  // Subscribe to real-time changes
  useEffect(() => {
    if (!conversationId) return;

    fetchMessages();

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
            setMessages(prev => {
              // Avoid duplicate if we added it optimistically
              const exists = prev.find(m => m.id === newMsg.id);
              if (exists) return prev.map(m => m.id === newMsg.id ? { ...newMsg, is_sending: false } : m);
              return [...prev, newMsg];
            });

            // If the incoming message is from someone else, mark it read immediately because we are viewing the chat
            if (user && newMsg.sender_id !== user.id && !newMsg.is_read) {
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
      // Best effort cleanup to avoid "WebSocket closed" noise
      // Delay cleanup slightly so WebSocket can finish connecting before closing
      setTimeout(() => {
        supabase.removeChannel(channel).catch(() => {
          // Ignore cleanup errors when unmounting fast
        });
      }, 500);
    };
  }, [conversationId, fetchMessages]);

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
      is_read: false,
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

      // Update conversation last_message
      await supabase
        .from('conversations')
        .update({
          last_message: text,
          last_message_at: new Date().toISOString()
        })
        .eq('id', conversationId);

    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('فشل إرسال الرسالة');
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
      setNewMessage(text); // Restore text
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

  return {
    messages,
    loading,
    newMessage,
    setNewMessage,
    isSending,
    sendMessage,
    selectedMessages,
    toggleSelection,
    clearSelection,
    deleteMessages
  };
}
