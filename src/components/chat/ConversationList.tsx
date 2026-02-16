import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useConversations } from '../../hooks/useConversations';
import { cn } from '../../lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Plus, X, Search, Loader2, User, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export function ConversationList() {
    const { conversations, loading } = useConversations();
    const navigate = useNavigate();
    const { conversationId } = useParams();
    const { user: currentUser } = useAuth();

    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [users, setUsers] = useState<any[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Fetch users for new chat
    useEffect(() => {
        if (showNewChatModal) {
            fetchUsers();
        }
    }, [showNewChatModal]);

    const fetchUsers = async () => {
        setLoadingUsers(true);
        try {
            // Fetch potential chat partners (e.g., admins, supervisors)
            // Excluding current user
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, avatar, role')
                .neq('id', currentUser?.id || '')
                .order('full_name');

            if (error) throw error;
            setUsers(data || []);
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoadingUsers(false);
        }
    };

    const handleCreateChat = () => {
        setShowNewChatModal(true);
    };

    const startConversation = async (partnerId: string) => {
        if (!currentUser) return;

        // 1. Check if conversation already exists locally
        const existing = conversations.find(c =>
            !c.is_group && c.participants.includes(partnerId)
        );

        if (existing) {
            setShowNewChatModal(false);
            navigate(`/chat/${existing.id}`);
            return;
        }

        // 2. Create new conversation in DB
        try {
            // Check DB purely to be safe (race conditions)
            // For now, simpler to just insert. 
            // If we want to prevent duplicates strictly, we'd query DB first.
            // Let's query DB first for safety.
            const { data: existingConvs } = await supabase
                .from('conversations')
                .select('*')
                .contains('participants', JSON.stringify([currentUser.id, partnerId]));

            // Filter ensuring exact pair for 1-on-1 (length 2 and contains both)
            // JSON container might return groups too if they have these 2. 
            // Simple check: is_group = false 
            const exactMatch = existingConvs?.find((c: any) => !c.is_group && c.participants.length === 2);

            if (exactMatch) {
                setShowNewChatModal(false);
                navigate(`/chat/${exactMatch.id}`);
                return;
            }

            // Insert new
            const { data: newConv, error } = await supabase
                .from('conversations')
                .insert([{
                    is_group: false,
                    participants: [currentUser.id, partnerId],
                    updated_at: new Date().toISOString()
                }])
                .select()
                .single();

            if (error) throw error;

            setShowNewChatModal(false);
            navigate(`/chat/${newConv.id}`);

            // Force reload conversations? The hook might need a refresh trigger.
            // Since we use real-time or just navigation, the layout might re-fetch or we need to expose a refetch.
            // For now, navigation will mount the chat. The list might lag a bit until refresh.
            // Ideally, pass refetch from hook.
            window.location.reload(); // Temporary brute force to refresh list or better: use valid state update
        } catch (error) {
            console.error('Error creating conversation:', error);
            alert('فشل إنشاء المحادثة');
        }
    };

    const filteredUsers = users.filter(u =>
        u.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="w-full md:w-80 border-l bg-white flex flex-col h-full relative">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50/50">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/', { state: { activeTab: 'admin_supervisors', adminViewMode: 'admin' } })}
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                        title="العودة لللوحة"
                    >
                        <ArrowRight className="w-5 h-5 text-gray-600" />
                    </button>
                    <h2 className="font-bold text-lg text-gray-800">المحادثات</h2>
                </div>
                <button onClick={handleCreateChat} className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-full transition-colors" title="محادثة جديدة">
                    <Plus className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="p-4 text-center text-gray-400">جاري التحميل...</div>
                ) : conversations.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-sm">
                        لا توجد محادثات.<br />ابدأ تواصل جديد!
                    </div>
                ) : (
                    conversations.map((conv: any) => (
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
                                placeholder="بحث عن مستخدم..."
                                className="w-full pr-9 pl-3 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                        {loadingUsers ? (
                            <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-emerald-500" /></div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="text-center p-8 text-gray-400 text-sm">لا يوجد مستخدمين</div>
                        ) : (
                            filteredUsers.map(user => (
                                <button
                                    key={user.id}
                                    onClick={() => startConversation(user.id)}
                                    className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 rounded-lg transition-colors text-right"
                                >
                                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold overflow-hidden">
                                        {user.avatar ? (
                                            <img src={user.avatar} alt={user.full_name} className="w-full h-full object-cover" />
                                        ) : (
                                            user.full_name?.[0] || <User className="w-5 h-5" />
                                        )}
                                    </div>
                                    <div>
                                        <div className="font-bold text-gray-800 text-sm">{user.full_name}</div>
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
}
