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
  unread_count?: number;
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
          const { data: profiles } = await supabase
            .rpc('get_available_profiles_by_ids', { profile_ids: [otherUserId] });
          const profile = profiles?.[0];

          if (profile) {
            name = profile.full_name || 'مستخدم';
            avatar_url = profile.avatar_url;
            member_profiles = [{
              id: profile.id,
              full_name: profile.full_name || 'مستخدم',
              avatar: profile.avatar_url
            }];
          }
        }
      } else if (conv.is_group && conv.participants && conv.participants.length > 0) {
        // Fetch all participants for group chat
        const { data: profiles } = await supabase
          .rpc('get_available_profiles_by_ids', { profile_ids: conv.participants });
        
        if (profiles) {
          member_profiles = profiles.map((p: any) => ({
            id: p.id,
            full_name: p.full_name || 'مستخدم',
            avatar: p.avatar_url
          }));
        }
      }

      setDetails({
        id: conv.id,
        name: name || 'محادثة',
        avatar_url,
        is_group: conv.is_group,
        participants: conv.participants,
        member_profiles: member_profiles
      });
      setLoading(false);
    }

    fetchDetails();
  }, [conversationId, user]);

  return { details, loading };
}
