import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { v4 as uuidv4 } from 'uuid';

import { sendPushNotification } from '../services/notifications';

const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * Compress an image file using Canvas API.
 * Returns a Blob in WebP format (or JPEG fallback) within the size limit.
 */
async function compressImage(file: File, maxSizeBytes: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      // Scale down large images
      const MAX_DIM = 1600;
      let { width, height } = img;
      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);

      // Try WebP first, then JPEG with decreasing quality
      const tryCompress = (quality: number) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('فشل ضغط الصورة'));
            if (blob.size <= maxSizeBytes || quality <= 0.3) {
              resolve(blob);
            } else {
              tryCompress(quality - 0.1);
            }
          },
          'image/webp',
          quality
        );
      };
      tryCompress(0.85);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('فشل تحميل الصورة'));
    };
    img.src = url;
  });
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string;
  audio_url?: string;
  image_url?: string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
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
    // Only show loading spinner if we have no messages yet to prevent flickering
    if (messages.length === 0) {
      setLoading(true);
    }

    const { data, error } = await supabase
      .from('messages')
      .select('*, read_by, deleted_by, sender:profiles!messages_sender_id_fkey(full_name)')
      .eq('conversation_id', conversationId)
      .not('deleted_by', 'cs', `{${user?.id}}`)
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
    if (!conversationId || !user) return;

    // Use the ref so this effect only depends on conversationId
    fetchMessagesRef.current();

    console.log('useChatState: Subscribing to chat', conversationId);

    // Use a stable channel name so Supabase can reuse it if the component re-renders
    const channelId = `chat_room_${conversationId}_${Math.random().toString(36).substring(7)}`;
    const channel = supabase.channel(channelId);

    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          // Removing server-side filter for now to guarantee delivery and filter manually
        },
        (payload) => {
          console.log(`Realtime Event [${conversationId}]:`, payload.eventType, payload);

          const newMsg = (payload.new || payload.old) as Message & { deleted_by?: string[] };

          // Manual filter check
          if (newMsg.conversation_id !== conversationId) {
            return;
          }

          // Ignore messages that the current user has explicitly deleted
          if (newMsg.deleted_by && newMsg.deleted_by.includes(user.id)) {
            if (payload.eventType === 'UPDATE') {
              // If an existing message was deleted by this user, remove it
              setMessages(prev => prev.filter(m => m.id !== newMsg.id));
            }
            return;
          }

          if (payload.eventType === 'INSERT') {
            // 1. Add it immediately, preserving optimistic data (image_url, audio_url)
            setMessages(prev => {
              const exists = prev.find(m => m.id === newMsg.id);
              if (exists) {
                // Merge: keep optimistic fields if the server payload doesn't have them
                return prev.map(m => m.id === newMsg.id ? {
                  ...m,           // Keep optimistic data (image_url, audio_url, etc.)
                  ...newMsg,       // Override with server data
                  image_url: newMsg.image_url || m.image_url,
                  audio_url: newMsg.audio_url || m.audio_url,
                  file_url: newMsg.file_url || m.file_url,
                  file_name: newMsg.file_name || m.file_name,
                  file_size: newMsg.file_size || m.file_size,
                  is_sending: false
                } : m);
              }
              return [...prev, newMsg];
            });

            // 2. Fetch sender profile async
            if (newMsg.sender_id && !newMsg.sender) {
              supabase
                .from('profiles')
                .select('full_name')
                .eq('id', newMsg.sender_id)
                .single()
                .then(({ data }) => {
                  if (data) {
                    setMessages(current =>
                      current.map(m => m.id === newMsg.id ? { ...m, sender: { full_name: data.full_name } } : m)
                    );
                  }
                });
            }

            // 3. Mark as read immediately if viewing
            if (newMsg.sender_id !== user.id) {
              // Mark as read
              supabase.rpc('mark_chat_read', { p_conversation_id: conversationId })
                .then(() => {
                  window.dispatchEvent(new CustomEvent('chat_read', {
                    detail: { conversationId }
                  }));
                });
            }
          } else if (payload.eventType === 'UPDATE') {
            setMessages(prev => prev.map(m => m.id === newMsg.id ? { ...m, ...newMsg } : m));
          } else if (payload.eventType === 'DELETE') {
            setMessages(prev => prev.filter(m => m.id !== (payload.old as any).id));
          }
        }
      )
      .subscribe((status) => {
        console.log(`useChatState: Status for ${conversationId}:`, status);
      });

    return () => {
      console.log('useChatState: Cleaning up channel for', conversationId);
      // Safely remove channel, ignore errors if already closed
      supabase.removeChannel(channel).catch(() => { });
    };
  }, [conversationId, user]);

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isSending || !newMessage.trim() || !user || !conversationId) return;

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

      // IMPORTANT: Clear sending state IMMEDIATELY so UI is responsive
      setIsSending(false);

      // 3. Update conversation last_message and clear deleted_by so it revives for others
      try {
        await supabase
          .from('conversations')
          .update({
            last_message: text,
            last_message_at: new Date().toISOString(),
            deleted_by: [] // إحياء المحادثة لدى الطرفين بمجرد وصول رسالة جديدة
          })
          .eq('id', conversationId);
      } catch (convErr) {
        console.error('Failed to update conversation state:', convErr);
      }

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
              sendPushNotification(recipientId, text, { 
                title: user.full_name, 
                url: `${window.location.origin}/chat/${conversationId}`,
                data: { conversationId }
              });
            });
          }
        } catch (err) {
          console.error('Background notification error:', err);
        }
      })();

    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('فشل إرسال الرسالة');
      // Remove optimistic message on failure ONLY if insertion failed
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
      setNewMessage(text); // Restore text
      setIsSending(false); // Ensure cleared
    }
  };

  // Voice Message Sending
  const sendVoiceMessage = async (audioBlob: Blob) => {
    if (isSending || !user || !conversationId) return;
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
      try {
        await supabase
          .from('conversations')
          .update({
            last_message: '🎤 رسالة صوتية',
            last_message_at: new Date().toISOString(),
            deleted_by: [], // إحياء المحادثة لدى الطرفين
          })
          .eq('id', conversationId);
      } catch (convErr) {
        console.error('Failed to update conversation state:', convErr);
      }

      // 6. Send Push Notification to recipients
      (async () => {
        try {
          const { data: convData } = await supabase
            .from('conversations')
            .select('participants')
            .eq('id', conversationId)
            .single();

          if (convData?.participants) {
            const recipients = (convData.participants as string[]).filter(id => id !== user.id);
            for (const recipientId of recipients) {
              sendPushNotification(recipientId, '🎤 رسالة صوتية', {
                title: user.full_name,
                url: `${window.location.origin}/chat/${conversationId}`,
                data: { conversationId }
              });
            }
          }
        } catch (err) {
          console.error('Background notification error:', err);
        }
      })();

    } catch (error) {
      console.error('Error sending voice message:', error);
      toast.error('فشل إرسال الرسالة الصوتية');
      // Remove optimistic message ONLY if insert failed
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
      // Cleanup uploaded file on failure
      supabase.storage.from('voice-messages').remove([filePath]).catch(() => { });
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
    if (selectedMessages.length === 0 || !user) return;

    const toastId = toast.loading('جاري الحذف...');
    try {
      // Split: own messages vs received messages
      const ownMsgIds: string[] = [];
      const receivedMsgIds: string[] = [];

      for (const msgId of selectedMessages) {
        const msg = messages.find(m => m.id === msgId);
        if (msg?.sender_id === user.id) {
          ownMsgIds.push(msgId);
        } else if (msg) {
          receivedMsgIds.push(msgId);
        }
      }

      console.log('[DeleteMessages] Own:', ownMsgIds, 'Received:', receivedMsgIds);

      // Hard delete own messages (RLS allows this - same as before)
      if (ownMsgIds.length > 0) {
        const { error } = await supabase
          .from('messages')
          .delete()
          .in('id', ownMsgIds);
        if (error) throw error;
        console.log('[DeleteMessages] Own messages deleted successfully');
      }

      // Soft delete received messages using RPC (SECURITY DEFINER bypasses RLS)
      for (const msgId of receivedMsgIds) {
        const { error } = await supabase.rpc('append_deleted_by', {
          p_message_id: msgId,
          p_user_id: user.id,
        });
        if (error) {
          console.error('[DeleteMessages] RPC error for', msgId, ':', error);
          throw error;
        }
        console.log('[DeleteMessages] Received message soft-deleted:', msgId);
      }

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

  // Image Message Sending
  const sendImageMessage = async (file: File) => {
    if (isSending || !user || !conversationId) return;

    // 1. Validate original file size first
    if (file.size > MAX_IMAGE_SIZE_BYTES * 3) {
      // If original is way too large (>6MB), reject immediately
      toast.error(`حجم الصورة كبير جداً. الحد الأقصى المسموح هو 2 ميجابايت`, { duration: 4000 });
      return;
    }

    setIsSending(true);
    const optimisticId = uuidv4();

    // Optimistic message with local preview
    const localPreviewUrl = URL.createObjectURL(file);
    const optimisticMsg: Message = {
      id: optimisticId,
      conversation_id: conversationId,
      sender_id: user.id,
      text: '📷 صورة',
      image_url: localPreviewUrl,
      created_at: new Date().toISOString(),
      is_sending: true,
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      // 2. Compress image
      let imageBlob: Blob;
      try {
        console.log(`[ImageSend] Compressing image: ${file.name}, size: ${(file.size / 1024).toFixed(0)}KB`);
        imageBlob = await compressImage(file, MAX_IMAGE_SIZE_BYTES);
        console.log(`[ImageSend] Compressed to: ${(imageBlob.size / 1024).toFixed(0)}KB`);
      } catch (compressErr) {
        console.error('[ImageSend] Compression failed:', compressErr);
        toast.error('فشل ضغط الصورة. جرّب صورة أخرى');
        setMessages(prev => prev.filter(m => m.id !== optimisticId));
        setIsSending(false);
        URL.revokeObjectURL(localPreviewUrl);
        return;
      }

      // 3. Final size check after compression
      if (imageBlob.size > MAX_IMAGE_SIZE_BYTES) {
        toast.error(`حجم الصورة بعد الضغط (${(imageBlob.size / 1024 / 1024).toFixed(1)} MB) لا يزال أكبر من 2 ميجابايت. جرّب صورة أصغر.`, { duration: 5000 });
        setMessages(prev => prev.filter(m => m.id !== optimisticId));
        setIsSending(false);
        URL.revokeObjectURL(localPreviewUrl);
        return;
      }

      // 4. Upload to storage
      const filePath = `${user.id}/${optimisticId}.webp`;
      console.log(`[ImageSend] Uploading to: image-message/${filePath}`);
      const { error: uploadError } = await supabase.storage
        .from('image-message')
        .upload(filePath, imageBlob, {
          contentType: 'image/webp',
          upsert: false,
        });

      if (uploadError) {
        console.error('[ImageSend] Upload failed:', uploadError);
        throw uploadError;
      }
      console.log('[ImageSend] Upload successful');

      // 5. Get public URL
      const { data: urlData } = supabase.storage
        .from('image-message')
        .getPublicUrl(filePath);
      const imageUrl = urlData.publicUrl;
      console.log('[ImageSend] Public URL:', imageUrl);

      // 6. Insert message
      console.log('[ImageSend] Inserting message into DB...');
      const { error: insertError } = await supabase
        .from('messages')
        .insert({
          id: optimisticId,
          conversation_id: conversationId,
          sender_id: user.id,
          text: '📷 صورة',
          image_url: imageUrl,
        });

      if (insertError) {
        console.error('[ImageSend] DB insert failed:', insertError);
        throw insertError;
      }
      console.log('[ImageSend] Message inserted successfully');

      // 7. Update optimistic message with real URL
      URL.revokeObjectURL(localPreviewUrl);
      setMessages(prev => prev.map(m =>
        m.id === optimisticId
          ? { ...m, image_url: imageUrl, is_sending: false }
          : m
      ));

      // 8. Update conversation
      try {
        await supabase
          .from('conversations')
          .update({
            last_message: '📷 صورة',
            last_message_at: new Date().toISOString(),
            deleted_by: [],
          })
          .eq('id', conversationId);
      } catch (convErr) {
        console.error('Failed to update conversation state:', convErr);
      }

      // 9. Send Push Notification
      (async () => {
        try {
          const { data: convData } = await supabase
            .from('conversations')
            .select('participants')
            .eq('id', conversationId)
            .single();

          if (convData?.participants) {
            const recipients = (convData.participants as string[]).filter(id => id !== user.id);
            for (const recipientId of recipients) {
              sendPushNotification(recipientId, '📷 صورة', {
                title: user.full_name,
                url: `${window.location.origin}/chat/${conversationId}`,
                data: { conversationId }
              });
            }
          }
        } catch (err) {
          console.error('Background notification error:', err);
        }
      })();

    } catch (error) {
      console.error('Error sending image message:', error);
      toast.error('فشل إرسال الصورة');
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
      URL.revokeObjectURL(localPreviewUrl);
      // Cleanup uploaded file on failure
      const filePath = `${user.id}/${optimisticId}.webp`;
      supabase.storage.from('image-message').remove([filePath]).catch(() => { });
    } finally {
      setIsSending(false);
    }
  };

  // File Message Sending
  const sendFileMessage = async (file: File) => {
    if (isSending || !user || !conversationId) return;

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit for general files
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`حجم الملف كبير جداً. الحد الأقصى المسموح هو 10 ميجابايت`, { duration: 4000 });
      return;
    }

    setIsSending(true);
    const optimisticId = uuidv4();

    const optimisticMsg: Message = {
      id: optimisticId,
      conversation_id: conversationId,
      sender_id: user.id,
      text: '📄 ملف',
      file_name: file.name,
      file_size: file.size,
      created_at: new Date().toISOString(),
      is_sending: true,
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      const ext = file.name.split('.').pop() || 'file';
      const filePath = `${user.id}/${optimisticId}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from('chat-files')
        .upload(filePath, file, {
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('chat-files')
        .getPublicUrl(filePath);
      
      const fileUrl = urlData.publicUrl;

      const { error: insertError } = await supabase
        .from('messages')
        .insert({
          id: optimisticId,
          conversation_id: conversationId,
          sender_id: user.id,
          text: '📄 ملف',
          file_url: fileUrl,
          file_name: file.name,
          file_size: file.size,
        });

      if (insertError) throw insertError;

      setMessages(prev => prev.map(m =>
        m.id === optimisticId
          ? { ...m, file_url: fileUrl, is_sending: false }
          : m
      ));

      try {
        await supabase
          .from('conversations')
          .update({
            last_message: '📄 ملف',
            last_message_at: new Date().toISOString(),
            deleted_by: [],
          })
          .eq('id', conversationId);
      } catch (convErr) {
        console.error('Failed to update conversation state:', convErr);
      }

      (async () => {
        try {
          const { data: convData } = await supabase
            .from('conversations')
            .select('participants')
            .eq('id', conversationId)
            .single();

          if (convData?.participants) {
            const recipients = (convData.participants as string[]).filter(id => id !== user.id);
            for (const recipientId of recipients) {
              sendPushNotification(recipientId, '📄 ملف جديد', {
                title: user.full_name,
                url: `${window.location.origin}/chat/${conversationId}`,
                data: { conversationId }
              });
            }
          }
        } catch (err) {
          console.error('Background notification error:', err);
        }
      })();

    } catch (error) {
      console.error('Error sending file message:', error);
      toast.error('فشل رفع الملف');
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
      
      const ext = file.name.split('.').pop() || 'file';
      const filePath = `${user.id}/${optimisticId}.${ext}`;
      supabase.storage.from('chat-files').remove([filePath]).catch(() => { });
    } finally {
      setIsSending(false);
    }
  };

  // Buzz Sending
  const sendBuzzMessage = async () => {
    if (isSending || !user || !conversationId) return;
    
    // We send a text message with a special flag
    const text = "🚨 تنبيه عاجل 🚨";
    setIsSending(true);

    const optimisticId = uuidv4();
    const optimisticMsg: Message = {
      id: optimisticId,
      conversation_id: conversationId,
      sender_id: user.id,
      text: text,
      created_at: new Date().toISOString(),
      is_sending: true,
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

      setIsSending(false);

      // Update conversation
      await supabase.from('conversations').update({
        last_message: text,
        last_message_at: new Date().toISOString(),
        deleted_by: []
      }).eq('id', conversationId);

      // Send Push with isBuzz: true
      const { data: convData } = await supabase
        .from('conversations')
        .select('participants')
        .eq('id', conversationId)
        .single();

      if (convData?.participants) {
        const recipients = (convData.participants as string[]).filter(id => id !== user.id);
        recipients.forEach(recipientId => {
          sendPushNotification(recipientId, text, {
            title: user.full_name,
            url: `${window.location.origin}/chat/${conversationId}`,
            data: { conversationId, isBuzz: true },
            isBuzz: true
          });
        });
      }
    } catch (error) {
      console.error('Error sending buzz:', error);
      toast.error('فشل إرسال التنبيه');
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
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
    sendMessage,
    sendVoiceMessage,
    sendImageMessage,
    sendFileMessage,
    sendBuzzMessage,
    selectedMessages,
    toggleSelection,
    clearSelection,
    deleteMessages,
    toggleReaction
  };
}
