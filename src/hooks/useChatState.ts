import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { v4 as uuidv4 } from 'uuid';

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string;
  read_by?: string[];
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
      supabase.removeChannel(channel).catch(() => { });
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

      // Update conversation last_message and clear deleted_by so it revives for others
      await supabase
        .from('conversations')
        .update({
          last_message: text,
          last_message_at: new Date().toISOString(),
          deleted_by: []
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
