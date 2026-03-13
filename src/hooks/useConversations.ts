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
                .select('*, participants, deleted_by')
                .contains('participants', JSON.stringify([user.id]))
                .order('last_message_at', { ascending: false });

            if (error) {
                console.error('Error fetching conversations:', error);
                setLoading(false);
                return;
            }

            // Hide conversations deleted by this user
            const visibleConvs = (data || []).filter(c => !c.deleted_by?.includes(user.id));

            // We need to resolve names/avatars for 1-on-1 chats
            // This might be N+1, but for a simple start it's okay. 
            // Optimization: Fetch all needed profiles in one go later.
            const resolved = await Promise.all(visibleConvs.map(async (conv: any) => {
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

        // Custom event for immediate deletion feedback
        window.addEventListener('chat_deleted', fetchConversations);

        // Realtime subscription (simplified)
        const subscription = supabase
            .channel('public:conversations')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, fetchConversations)
            .subscribe();

        return () => {
            window.removeEventListener('chat_deleted', fetchConversations);
            supabase.removeChannel(subscription).catch(() => {
                // Ignore cleanup errors
            });
        };
    }, [user]);

    const createConversation = async (partnerId: string) => {
        if (!user) return null;
        try {
            const { data, error } = await supabase
                .from('conversations')
                .insert([{
                    is_group: false,
                    participants: [user.id, partnerId],
                    updated_at: new Date().toISOString()
                }])
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error creating conversation:', error);
            return null;
        }
    };

    const createGroupConversation = async (name: string, selectedUserIds: string[]) => {
        if (!user) return null;
        try {
            // Group chat includes the creator and all selected users
            const participants = [user.id, ...selectedUserIds];

            const { data, error } = await supabase
                .from('conversations')
                .insert([{
                    is_group: true,
                    name: name,
                    participants: participants,
                    updated_at: new Date().toISOString()
                }])
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error creating group conversation:', error);
            return null;
        }
    };

    return { conversations, loading, createConversation, createGroupConversation };
}
