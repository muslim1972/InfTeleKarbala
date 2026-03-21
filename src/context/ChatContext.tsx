import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { ConversationDetails } from '../hooks/useConversationDetails';

interface ChatContextType {
    conversations: ConversationDetails[];
    loading: boolean;
    totalUnreadCount: number;
    fetchConversations: (isInitial?: boolean) => Promise<void>;
    createConversation: (partnerId: string) => Promise<any>;
    createGroupConversation: (name: string, selectedUserIds: string[]) => Promise<any>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [conversations, setConversations] = useState<ConversationDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const optimisticallyClearedChats = useRef<Set<string>>(new Set());

    const fetchConversations = useCallback(async (isInitial = false) => {
        if (!user || user.id === 'visitor-id') {
            setLoading(false);
            return;
        }
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
            if (convIds.length === 0) {
                setConversations([]);
                setLoading(false);
                return;
            }

            const { data: unreadData } = await supabase
                .from('messages')
                .select('conversation_id')
                .in('conversation_id', convIds)
                .neq('sender_id', user.id)
                .not('read_by', 'cs', `{${user.id}}`);

            const unreadMap: Record<string, number> = {};
            unreadData?.forEach(m => {
                if (!optimisticallyClearedChats.current.has(m.conversation_id)) {
                    unreadMap[m.conversation_id] = (unreadMap[m.conversation_id] || 0) + 1;
                }
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
                    .select('id, full_name, avatar_url')
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
                        avatar_url = profile.avatar_url;
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
            console.error('ChatContext: Error fetching conversations:', error);
        } finally {
            if (isInitial) setLoading(false);
        }
    }, [user?.id]); // Only depend on user.id to avoid unnecessary re-renders if the whole user object changes

    // Subscriptions
    useEffect(() => {
        if (!user || user.id === 'visitor-id') return;

        fetchConversations(true);

        const handleRefresh = () => fetchConversations();
        
        // Listen for internal app events
        window.addEventListener('chat_deleted', handleRefresh);
        
        const handleChatRead = (e: Event) => {
            const customEvent = e as CustomEvent<{ conversationId: string }>;
            if (customEvent.detail?.conversationId) {
                const convId = customEvent.detail.conversationId;
                optimisticallyClearedChats.current.add(convId);
                
                // Optimistically clear it in local state immediately
                setConversations(prev => prev.map(c => 
                    c.id === convId ? { ...c, unread_count: 0 } : c
                ));

                // Remove from "cleared" immunity after 3 seconds
                setTimeout(() => {
                    optimisticallyClearedChats.current.delete(convId);
                }, 3000);
            }
            fetchConversations();
        };

        window.addEventListener('chat_read', handleChatRead);

        // Supabase Realtime - ONE SINGLE CHANNEL for the entire app
        const channelId = `global_chat_sync_${user.id.substring(0, 8)}_${Math.random().toString(36).substring(7)}`;
        const chatChannel = supabase.channel(channelId)
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'conversations' 
            }, () => {
                console.log('ChatContext: Conversations changed, refreshing...');
                fetchConversations();
            })
            // Optimization: Also listen to messages table to catch new arrivals faster
            // But only if we want ultra-realtime on the list. 
            // The conversations table is already updated in useChatState by the sender.
            .subscribe((status) => {
                console.log('ChatContext: Subscription status:', status);
            });

        return () => {
            window.removeEventListener('chat_deleted', handleRefresh);
            window.removeEventListener('chat_read', handleChatRead);
            supabase.removeChannel(chatChannel).catch(() => { });
        };
    }, [user?.id, fetchConversations]);

    const createConversation = async (partnerId: string) => {
        if (!user) return null;
        try {
            // Logic from useConversations.ts...
            const { data: partnerProfile } = await supabase.from('profiles').select('id, job_number').eq('id', partnerId).single();
            const partnerUuids = [partnerId];
            const jobNumber = partnerProfile?.job_number;
            if (jobNumber) {
                const { data: siblings } = await supabase.from('profiles').select('id').eq('job_number', jobNumber);
                if (siblings) siblings.forEach(s => { if (!partnerUuids.includes(s.id)) partnerUuids.push(s.id); });
            }
            const { data: possibles } = await supabase.from('conversations').select('*').eq('is_group', false).contains('participants', JSON.stringify([user.id]));
            if (possibles) {
                const existing = possibles.find(c => {
                    const parts = c.participants || [];
                    if (parts.length !== 2) return false;
                    const partIds = parts.map((p: any) => typeof p === 'string' ? p : p.user_id);
                    return partIds.includes(user.id) && partIds.some((pId: string) => partnerUuids.includes(pId));
                });
                if (existing) return existing;
            }
            const { data, error } = await supabase.from('conversations').insert([{
                is_group: false,
                participants: [user.id, partnerId],
                updated_at: new Date().toISOString(),
                last_message_at: new Date().toISOString()
            }]).select().single();
            if (error) throw error;
            fetchConversations(); // Refresh list
            return data;
        } catch (error) {
            console.error('ChatContext: Error in createConversation:', error);
            return null;
        }
    };

    const createGroupConversation = async (name: string, selectedUserIds: string[]) => {
        if (!user) return null;
        try {
            const participants = [user.id, ...selectedUserIds];
            const { data, error } = await supabase.from('conversations').insert([{
                is_group: true,
                name: name,
                participants: participants,
                updated_at: new Date().toISOString()
            }]).select().single();
            if (error) throw error;
            fetchConversations(); // Refresh list
            return data;
        } catch (error) {
            console.error('ChatContext: Error creating group conversation:', error);
            return null;
        }
    };

    const totalUnreadCount = conversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);

    return (
        <ChatContext.Provider value={{ conversations, loading, totalUnreadCount, fetchConversations, createConversation, createGroupConversation }}>
            {children}
        </ChatContext.Provider>
    );
};

export const useChat = () => {
    const context = useContext(ChatContext);
    if (context === undefined) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
};
