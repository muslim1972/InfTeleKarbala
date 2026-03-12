import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export interface ParticipantProfile {
  id: string;
  full_name: string;
  avatar?: string;
}

export interface ConversationDetails {
  id: string;
  name: string;
  avatar_url?: string;
  is_group: boolean;
  participants: string[];
  member_profiles?: ParticipantProfile[];
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
      let member_profiles: ParticipantProfile[] = [];

      // If it's a 1-on-1 chat, get the other user's name/avatar
      if (!conv.is_group && conv.participants) {
        const otherUserId = conv.participants.find((id: string) => id !== user.id);
        if (otherUserId) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, full_name, avatar')
            .eq('id', otherUserId)
            .single();

          if (profile) {
            name = profile.full_name || 'مستخدم';
            avatar_url = profile.avatar;
          }
        }
      } else if (conv.is_group && conv.participants && conv.participants.length > 0) {
        // Fetch all participants for group chat
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar')
          .in('id', conv.participants);
        
        if (profiles) {
          member_profiles = profiles.map(p => ({
            id: p.id,
            full_name: p.full_name || 'مستخدم',
            avatar: p.avatar
          }));
        }
      }

      setDetails({
        id: conv.id,
        name: name || 'محادثة',
        avatar_url,
        is_group: conv.is_group,
        participants: conv.participants,
        member_profiles: conv.is_group ? member_profiles : undefined
      });
      setLoading(false);
    }

    fetchDetails();
  }, [conversationId, user]);

  return { details, loading };
}
