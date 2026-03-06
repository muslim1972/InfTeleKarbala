import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useConversations } from '../../hooks/useConversations';
import { cn } from '../../lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Plus, X, Search, Loader2, User, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useQuery } from '@tanstack/react-query';

export const ConversationList = () => {
    const { conversations, loading, createConversation } = useConversations();
    const { conversationId } = useParams();
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();

    // State
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Search State
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Initial fetch of users (cached)
    const { data: users = [], isLoading: loadingUsers } = useQuery({
        queryKey: ['chat-users-default', currentUser?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, role')
                .neq('id', currentUser?.id)
                .limit(50);
            if (error) throw error;
            return data || [];
        },
        enabled: showNewChatModal && !!currentUser?.id,
        staleTime: 5 * 60 * 1000, // 5 minutes cache
    });

    // Search results (cached)
    const { data: searchResults = [], isFetching: isSearching } = useQuery({
        queryKey: ['chat-users-search', debouncedSearchQuery, currentUser?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, role, job_number')
                .or(`job_number.ilike.${debouncedSearchQuery}%,full_name.ilike.${debouncedSearchQuery}%`)
                .limit(20);

            if (error) throw error;
            return data?.filter(u => u.id !== currentUser?.id) || [];
        },
        enabled: showNewChatModal && !!debouncedSearchQuery.trim() && !!currentUser?.id,
        staleTime: 1 * 60 * 1000, // 1 minute cache for search results
    });

    const handleCreateChat = () => {
        setShowNewChatModal(true);
        setSearchQuery('');
    };

    const startConversation = async (partnerId: string) => {
        try {
            // Check if conversation exists (individual only)
            const existingConv = conversations.find((c: any) =>
                !c.is_group &&
                c.participants.some((p: any) => p.user_id === partnerId)
            );

            if (existingConv) {
                setShowNewChatModal(false);
                navigate(`/chat/${existingConv.id}`);
                return;
            }

            const newConv = await createConversation(partnerId);
            if (!newConv) return;

            setShowNewChatModal(false);
            navigate(`/chat/${newConv.id}`);
            window.location.reload();
        } catch (error) {
            console.error('Error in startConversation:', error);
        }
    };

    // Use search results if query exists, otherwise show default users list
    const displayUsers = debouncedSearchQuery.trim() ? searchResults : users;

    // Unified View: Show all conversations EXCEPT Supervisors Group
    // User requested to remove Supervisors Group from this list
    const filteredConversations = conversations.filter((c: any) =>
        c.name !== 'مجموعة المشرفين' &&
        c.name !== 'Supervisors Group'
    );

    return (
        <div className="w-full md:w-80 border-l bg-white flex flex-col h-full relative">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50/50">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/')}
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                        title="العودة للخلف"
                    >
                        <ArrowRight className="w-5 h-5 text-gray-600" />
                    </button>
                    <h2 className="font-bold text-lg text-gray-800">المحادثات</h2>
                </div>
                {/* New Chat Button - Available to everyone */}
                <button onClick={handleCreateChat} className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-full transition-colors" title="محادثة جديدة">
                    <Plus className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="p-4 text-center text-gray-400">جاري التحميل...</div>
                ) : filteredConversations.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-sm">
                        لا توجد محادثات.
                        <br />
                        ابدأ تواصل جديد!
                    </div>
                ) : (
                    filteredConversations.map((conv: any) => (
                        <div
                            key={conv.id}
                            onClick={() => navigate(`/chat/${conv.id}`)}
                            className={cn(
                                "p-3 border-b cursor-pointer hover:bg-emerald-50/50 transition-colors flex items-center gap-3",
                                conversationId === conv.id ? "bg-emerald-50 border-r-4 border-r-emerald-600" : ""
                            )}
                        >
                            <div className="w-12 h-12 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden">
                                {conv.avatar_url ? (
                                    <img src={conv.avatar_url} alt={conv.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold text-lg bg-gray-100">
                                        {conv.name?.[0]}
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0 text-right">
                                <div className="flex justify-between items-baseline mb-1">
                                    <h3 className="font-semibold text-gray-900 truncate">{conv.name}</h3>
                                    {conv.last_message_at && (
                                        <span className="text-[10px] text-gray-400 flex-shrink-0">
                                            {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true, locale: ar })}
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-gray-500 truncate font-light">
                                    {conv.last_message || 'مرفق'}
                                </p>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* New Chat Modal Overlay */}
            {showNewChatModal && (
                <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm flex flex-col animate-in fade-in duration-200">
                    <div className="p-4 border-b flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="بحث عن مستخدم (الاسم أو الرقم الوظيفي)..."
                                className="w-full pr-9 pl-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <button onClick={() => setShowNewChatModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2">
                        {loadingUsers || isSearching ? (
                            <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-emerald-500" /></div>
                        ) : displayUsers.length === 0 ? (
                            <div className="text-center p-8 text-gray-400 text-sm">لا يوجد مستخدمين</div>
                        ) : (
                            displayUsers.map(user => (
                                <button
                                    key={user.id}
                                    onClick={() => startConversation(user.id)}
                                    className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 rounded-lg transition-colors text-right"
                                >
                                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold overflow-hidden">
                                        {user.avatar_url ? (
                                            <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-lg bg-emerald-100">
                                                <User className="w-5 h-5" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-semibold text-gray-900">{user.full_name}</div>
                                        <div className="text-xs text-gray-500">{user.role === 'admin' ? 'مشرف' : 'موظف'}</div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
