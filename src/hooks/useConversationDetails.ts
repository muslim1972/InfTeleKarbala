import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export interface ConversationDetails {
  id: string;
  name: string;
  avatar_url?: string;
  is_group: boolean;
  participants: string[];
}

export function useConversationDetails(conversationId: string) {
  const { user } = useAuth();
  const [details, setDetails] = useState<ConversationDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDetails() {
      if (!conversationId || !user) return;
      setLoading(true);

      const { data: conv, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (error || !conv) {
        console.error('Error fetching conversation details:', error);
        setLoading(false);
        return;
      }

      let name = conv.name;
      let avatar_url = conv.avatar_url;

      // If it's a 1-on-1 chat, get the other user's name/avatar
      if (!conv.is_group && conv.participants) {
        const otherUserId = conv.participants.find((id: string) => id !== user.id);
        if (otherUserId) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, avatar')
            .eq('id', otherUserId)
            .single();

          if (profile) {
            name = profile.full_name || 'مستخدم';
            avatar_url = profile.avatar;
          }
        }
      }

      setDetails({
        id: conv.id,
        name: name || 'محادثة',
        avatar_url,
        is_group: conv.is_group,
        participants: conv.participants
      });
      setLoading(false);
    }

    fetchDetails();
  }, [conversationId, user]);

  return { details, loading };
}
