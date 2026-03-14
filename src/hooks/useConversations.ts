import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { ConversationDetails } from './useConversationDetails';

export function useConversations() {
    const { user } = useAuth();
    const [conversations, setConversations] = useState<ConversationDetails[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchConversations = useCallback(async (isInitial = false) => {
        if (!user) return;
        if (isInitial) setLoading(true);

        try {
            // 1. Fetch conversations
            const { data: convs, error: convError } = await supabase
                .from('conversations')
                .select('*, participants, deleted_by')
                .contains('participants', JSON.stringify([user.id]))
                .order('last_message_at', { ascending: false });

            if (convError) throw convError;

            const visibleConvs = (convs || []).filter(c => !c.deleted_by?.includes(user.id));

            // 2. Resolve unread counts in bulk
            const convIds = visibleConvs.map(c => c.id);
            const { data: unreadData } = await supabase
                .from('messages')
                .select('conversation_id')
                .in('conversation_id', convIds)
                .neq('sender_id', user.id)
                .not('read_by', 'cs', `{${user.id}}`);

            const unreadMap: Record<string, number> = {};
            unreadData?.forEach(m => {
                unreadMap[m.conversation_id] = (unreadMap[m.conversation_id] || 0) + 1;
            });

            // 3. Resolve profile info in bulk for 1-on-1 chats
            const otherUserIds = [...new Set(visibleConvs
                .filter(c => !c.is_group)
                .map(c => c.participants.find((id: string) => id !== user.id))
                .filter(Boolean))] as string[];

            const profileMap: Record<string, any> = {};
            if (otherUserIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, full_name, avatar')
                    .in('id', otherUserIds);
                profiles?.forEach(p => { profileMap[p.id] = p; });
            }

            // 4. Transform into final display format
            const resolved = visibleConvs.map((conv: any) => {
                let name = conv.name;
                let avatar_url = conv.avatar_url;

                if (!conv.is_group) {
                    const otherUserId = conv.participants.find((id: string) => id !== user.id);
                    const profile = otherUserId ? profileMap[otherUserId] : null;
                    if (profile) {
                        name = profile.full_name;
                        avatar_url = profile.avatar;
                    }
                }

                return {
                    id: conv.id,
                    name: name || 'محادثة',
                    avatar_url,
                    is_group: conv.is_group,
                    participants: conv.participants,
                    last_message: conv.last_message,
                    last_message_at: conv.last_message_at,
                    unread_count: unreadMap[conv.id] || 0
                };
            });

            setConversations(resolved);
        } catch (error) {
            console.error('Error fetching conversations:', error);
        } finally {
            if (isInitial) setLoading(false);
        }
    }, [user]);

    // Initial Load & Subscriptions
    useEffect(() => {
        fetchConversations(true);

        const handleRefresh = () => fetchConversations();
        window.addEventListener('chat_deleted', handleRefresh);
        window.addEventListener('chat_read', handleRefresh);

        const chatChannel = supabase.channel(`chat_list_${user?.id?.substring(0, 8)}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
                fetchConversations();
            })
            .subscribe();

        return () => {
            window.removeEventListener('chat_deleted', handleRefresh);
            window.removeEventListener('chat_read', handleRefresh);
            supabase.removeChannel(chatChannel).catch(() => { });
        };
    }, [user, fetchConversations]);

    const createConversation = async (partnerId: string) => {
        if (!user) return null;
        try {
            // 1. Get the job_number of the partner
            const { data: partnerProfile } = await supabase
                .from('profiles')
                .select('id, job_number')
                .eq('id', partnerId)
                .single();

            const partnerUuids = [partnerId];
            const jobNumber = partnerProfile?.job_number;

            if (jobNumber) {
                const { data: siblings } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('job_number', jobNumber);
                if (siblings) {
                    siblings.forEach(s => {
                        if (!partnerUuids.includes(s.id)) partnerUuids.push(s.id);
                    });
                }
            }
            
            // 2. Search for existing 1-on-1 chat
            const { data: possibles } = await supabase
                .from('conversations')
                .select('*')
                .eq('is_group', false)
                .contains('participants', JSON.stringify([user.id]));

            if (possibles) {
                const existing = possibles.find(c => {
                    const parts = c.participants || [];
                    if (parts.length !== 2) return false;
                    const partIds = parts.map((p: any) => typeof p === 'string' ? p : p.user_id);
                    return partIds.includes(user.id) && partIds.some((pId: string) => partnerUuids.includes(pId));
                });

                if (existing) return existing;
            }

            // 3. Create new if not found
            const { data, error } = await supabase
                .from('conversations')
                .insert([{
                    is_group: false,
                    participants: [user.id, partnerId],
                    updated_at: new Date().toISOString(),
                    last_message_at: new Date().toISOString()
                }])
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error in createConversation:', error);
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

    const totalUnreadCount = conversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);

    return { conversations, loading, totalUnreadCount, createConversation, createGroupConversation };
}
