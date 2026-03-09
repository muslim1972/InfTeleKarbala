import { useState, useEffect } from 'react';
import { X, Search, Loader2, User, MessageSquare, Users, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { cn } from '../../lib/utils';

interface NewChatModalProps {
    onClose: () => void;
    onStartDirectChat: (userId: string) => void;
    onStartGroupChat: (name: string, userIds: string[]) => void;
}

export const NewChatModal = ({ onClose, onStartDirectChat, onStartGroupChat }: NewChatModalProps) => {
    const { user: currentUser } = useAuth();

    // Modes: 'select_type' | 'direct' | 'group'
    const [mode, setMode] = useState<'select_type' | 'direct' | 'group'>('select_type');

    // Group State
    const [groupName, setGroupName] = useState('');
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Initial fetch of users (cached)
    const { data: users = [], isLoading: loadingUsers } = useQuery({
        queryKey: ['chat-users-new-modal', currentUser?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, role, job_number')
                .neq('id', currentUser?.id)
                .limit(50);
            if (error) throw error;
            return data || [];
        },
        enabled: !!currentUser?.id,
        staleTime: 5 * 60 * 1000,
    });

    // Search results (cached)
    const { data: searchResults = [], isFetching: isSearching } = useQuery({
        queryKey: ['chat-users-search-modal', debouncedSearchQuery, currentUser?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, role, job_number')
                .or(`job_number.ilike.${debouncedSearchQuery}%,full_name.ilike.${debouncedSearchQuery}%`)
                .limit(20);

            if (error) throw error;
            return data?.filter(u => u.id !== currentUser?.id) || [];
        },
        enabled: !!debouncedSearchQuery.trim() && !!currentUser?.id,
        staleTime: 1 * 60 * 1000,
    });

    const displayUsers = debouncedSearchQuery.trim() ? searchResults : users;

    const toggleUserSelection = (userId: string) => {
        const newSet = new Set(selectedUsers);
        if (newSet.has(userId)) {
            newSet.delete(userId);
        } else {
            newSet.add(userId);
        }
        setSelectedUsers(newSet);
    };

    const handleCreateGroup = () => {
        if (!groupName.trim() || selectedUsers.size === 0) return;
        onStartGroupChat(groupName.trim(), Array.from(selectedUsers));
    };

    return (
        <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm flex flex-col animate-in fade-in duration-200">
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between bg-white sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                    <h2 className="font-bold text-lg text-gray-800">
                        {mode === 'select_type' ? 'محادثة جديدة' : mode === 'direct' ? 'محادثة فردية' : 'مجموعة جديدة'}
                    </h2>
                </div>

                {mode === 'select_type' && (
                    <div className="w-9" /> // spacer to balance the header
                )}
                {mode === 'direct' && (
                    <button onClick={() => setMode('select_type')} className="text-xs text-emerald-600 font-bold hover:underline">رجوع</button>
                )}
                {mode === 'group' && (
                    <button
                        onClick={handleCreateGroup}
                        disabled={!groupName.trim() || selectedUsers.size === 0}
                        className="bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-700 transition"
                    >
                        إنشاء
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col p-4 custom-scrollbar">

                {/* Mode Selection */}
                {mode === 'select_type' && (
                    <div className="flex flex-col gap-4 mt-4">
                        <button
                            onClick={() => setMode('direct')}
                            className="bg-white border-2 border-emerald-100 hover:border-emerald-500 hover:bg-emerald-50 rounded-2xl p-6 flex items-center gap-4 transition-all group"
                        >
                            <div className="bg-emerald-100 text-emerald-600 p-4 rounded-full group-hover:scale-110 transition-transform">
                                <MessageSquare size={28} />
                            </div>
                            <div className="text-right">
                                <h3 className="font-bold text-gray-900 text-lg mb-1">محادثة فردية</h3>
                                <p className="text-sm text-gray-500">ابدأ محادثة خاصة مع موظف أو زميل مسجل في النظام.</p>
                            </div>
                        </button>

                        <button
                            onClick={() => setMode('group')}
                            className="bg-white border-2 border-indigo-100 hover:border-indigo-500 hover:bg-indigo-50 rounded-2xl p-6 flex items-center gap-4 transition-all group"
                        >
                            <div className="bg-indigo-100 text-indigo-600 p-4 rounded-full group-hover:scale-110 transition-transform">
                                <Users size={28} />
                            </div>
                            <div className="text-right">
                                <h3 className="font-bold text-gray-900 text-lg mb-1">مجموعة جديدة</h3>
                                <p className="text-sm text-gray-500">أنشئ مجموعة تضم عدة موظفين للنقاش والعمل المشترك.</p>
                            </div>
                        </button>
                    </div>
                )}

                {/* Direct or Group Creation Flow */}
                {(mode === 'direct' || mode === 'group') && (
                    <div className="flex flex-col h-full gap-4">

                        {mode === 'group' && (
                            <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                                <input
                                    type="text"
                                    placeholder="اسم المجموعة (مثل: اجتماع القسم التنفيذي)..."
                                    className="w-full px-4 py-3 bg-white border border-indigo-200 rounded-xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                    autoFocus
                                />
                                <p className="text-xs text-indigo-600 mt-2 font-medium">قم بتحديد أعضاء المجموعة من القائمة أدناه ({selectedUsers.size} محدد)</p>
                            </div>
                        )}

                        <div className="relative">
                            <Search className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="ابحث بالاسم أو الرقم الوظيفي..."
                                className="w-full pr-10 pl-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50/30">
                            {loadingUsers || isSearching ? (
                                <div className="flex justify-center items-center h-40">
                                    <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                                </div>
                            ) : displayUsers.length === 0 ? (
                                <div className="text-center p-8 text-gray-400 text-sm h-40 flex flex-col items-center justify-center">
                                    <Search className="w-12 h-12 text-gray-200 mb-2" />
                                    لا يوجد مستخدمين بهذا الاسم
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100">
                                    {displayUsers.map(user => {
                                        const isSelected = selectedUsers.has(user.id);
                                        return (
                                            <div
                                                key={user.id}
                                                onClick={() => {
                                                    if (mode === 'direct') {
                                                        onStartDirectChat(user.id);
                                                    } else {
                                                        toggleUserSelection(user.id);
                                                    }
                                                }}
                                                className={cn(
                                                    "w-full p-3 flex items-center gap-4 transition-colors cursor-pointer",
                                                    mode === 'direct' ? "hover:bg-emerald-50" : "hover:bg-indigo-50",
                                                    isSelected ? "bg-indigo-50/80" : "bg-white"
                                                )}
                                            >
                                                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold overflow-hidden border border-gray-200 shrink-0">
                                                    {user.avatar_url ? (
                                                        <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <User className="w-6 h-6" />
                                                    )}
                                                </div>
                                                <div className="flex-1 text-right">
                                                    <div className="font-bold text-gray-900 text-sm">{user.full_name}</div>
                                                    <div className="text-[11px] text-gray-500 mt-0.5">{user.role === 'admin' ? 'مشرف' : 'موظف'} • {user.job_number || 'بدون رقم'}</div>
                                                </div>

                                                {mode === 'group' && (
                                                    <div className={cn(
                                                        "w-6 h-6 rounded-md flex items-center justify-center border transition-all shrink-0 ml-2",
                                                        isSelected ? "bg-indigo-600 border-indigo-600 text-white" : "border-gray-300 bg-white"
                                                    )}>
                                                        {isSelected && <Check size={14} strokeWidth={3} />}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
