import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { ConversationDetails } from './useConversationDetails';

export function useConversations() {
    const { user } = useAuth();
    const [conversations, setConversations] = useState<ConversationDetails[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchConversations() {
            if (!user) return;
            setLoading(true);

            // complex query to get conversations user is part of
            // Supabase has JSONB contains, so we can use that.
            const { data, error } = await supabase
                .from('conversations')
                .select('*')
                .contains('participants', JSON.stringify([user.id])) // or just user.id if array of strings
                .order('last_message_at', { ascending: false });

            if (error) {
                console.error('Error fetching conversations:', error);
                setLoading(false);
                return;
            }

            // We need to resolve names/avatars for 1-on-1 chats
            // This might be N+1, but for a simple start it's okay. 
            // Optimization: Fetch all needed profiles in one go later.
            const resolved = await Promise.all(data.map(async (conv: any) => {
                let name = conv.name;
                let avatar_url = conv.avatar_url;

                if (!conv.is_group) {
                    const otherUserId = conv.participants.find((id: string) => id !== user.id);
                    if (otherUserId) {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('full_name, avatar')
                            .eq('id', otherUserId)
                            .single();
                        if (profile) {
                            name = profile.full_name;
                            avatar_url = profile.avatar;
                        }
                    }
                }

                return {
                    id: conv.id,
                    name: name || 'محادثة',
                    avatar_url,
                    is_group: conv.is_group,
                    participants: conv.participants,
                    last_message: conv.last_message,
                    last_message_at: conv.last_message_at
                };
            }));

            setConversations(resolved);
            setLoading(false);
        }

        fetchConversations();
    }, [user]);

    return { conversations, loading };
}
