import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useConversations } from '../../hooks/useConversations';
import { cn } from '../../lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Plus, X, Search, Loader2, User, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export const ConversationList = () => {
    const { conversations, loading, createConversation } = useConversations();
    const { conversationId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { user: currentUser } = useAuth();

    // State
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [users, setUsers] = useState<any[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    // Search State
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const adminViewMode = (location.state as any)?.adminViewMode;

    useEffect(() => {
        if (showNewChatModal) {
            fetchUsers();
        }
    }, [showNewChatModal]);

    // Initial fetch of users (limited or full depending on strategy)
    // For now, we fetch initial batch for the "default" view, or rely on search.
    const fetchUsers = async () => {
        setLoadingUsers(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, role')
                .neq('id', currentUser?.id)
                .limit(50); // Initial limit

            if (error) throw error;
            setUsers(data || []);
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoadingUsers(false);
        }
    };

    // Debounced Search Effect (Server-Side)
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (!searchQuery?.trim()) {
                setSearchResults([]);
                return;
            }

            setIsSearching(true);
            try {
                // Exact logic from AdminDashboard
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, full_name, avatar_url, role, job_number') // Added avatar_url
                    .or(`job_number.ilike.${searchQuery}%,full_name.ilike.${searchQuery}%`)
                    .limit(20);

                if (error) throw error;
                // Filter out current user
                setSearchResults(data?.filter(u => u.id !== currentUser?.id) || []);
            } catch (err) {
                console.error('Search error:', err);
            } finally {
                setIsSearching(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [searchQuery, currentUser?.id]);

    const handleCreateChat = () => {
        setShowNewChatModal(true);
        setSearchQuery('');
        setSearchResults([]);
    };

    const startConversation = async (partnerId: string) => {
        try {
            // Check if conversation exists
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
            if (!newConv) return; // Error handled in hook

            setShowNewChatModal(false);
            navigate(`/chat/${newConv.id}`);

            // Reload to show new conversation in list immediately
            window.location.reload();
        } catch (error) {
            console.error('Error in startConversation:', error);
        }
    };

    // Use search results if query exists, otherwise show default users list
    const displayUsers = searchQuery.trim() ? searchResults : users;

    // Filter conversations based on View Mode
    const filteredConversations = conversations.filter(c => {
        // Admin View: Only Groups
        if (adminViewMode === 'admin') {
            return c.is_group === true;
        }
        // User View: Only Individual
        return c.is_group === false;
    });

    return (
        <div className="w-full md:w-80 border-l bg-white flex flex-col h-full relative">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50/50">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            if (adminViewMode === 'user') {
                                navigate('/dashboard');
                            } else {
                                navigate('/', { state: { activeTab: 'admin_supervisors' } });
                            }
                        }}
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                        title="العودة لللوحة"
                    >
                        <ArrowRight className="w-5 h-5 text-gray-600" />
                    </button>
                    <h2 className="font-bold text-lg text-gray-800">المحادثات</h2>
                </div>
                {/* Only show "New Chat" button for users, or if admins need to start groups (different logic maybe) */}
                {adminViewMode !== 'admin' && (
                    <button onClick={handleCreateChat} className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-full transition-colors" title="محادثة جديدة">
                        <Plus className="w-5 h-5" />
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="p-4 text-center text-gray-400">جاري التحميل...</div>
                ) : filteredConversations.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-sm">
                        {adminViewMode === 'admin'
                            ? 'لا توجد مجموعات نشطة.'
                            : 'لا توجد محادثات.\nابدأ تواصل جديد!'}
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
