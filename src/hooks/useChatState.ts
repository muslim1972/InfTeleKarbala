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
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      toast.error('فشل تحميل الرسائل');
    } else {
      setMessages(data || []);
    }
    setLoading(false);
  }, [conversationId]);

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
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages(prev => {
            // Avoid duplicate if we added it optimistically
            const exists = prev.find(m => m.id === newMsg.id);
            if (exists) return prev.map(m => m.id === newMsg.id ? { ...newMsg, is_sending: false } : m);
            return [...prev, newMsg];
          });
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
      try {
        supabase.removeChannel(channel);
      } catch (e) {
        // Ignore cleanup errors
      }
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

  return {
    messages,
    loading,
    newMessage,
    setNewMessage,
    isSending,
    sendMessage
  };
}
