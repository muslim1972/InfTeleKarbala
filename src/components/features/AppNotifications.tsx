import { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, X, CheckCircle, MessageCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { ApprovalModal } from '../../features/requests/components/ApprovalModal';
import { useNavigate } from 'react-router-dom';

export const AppNotifications = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [showModal, setShowModal] = useState(false);

    // Badge Counts
    const [employeeUnreadCount, setEmployeeUnreadCount] = useState(0);
    const [supervisorPendingCount, setSupervisorPendingCount] = useState(0);
    const [hrPendingCount, setHrPendingCount] = useState(0);
    const [chatUnreadCount, setChatUnreadCount] = useState(0);

    // Data lists
    const [employeeRequests, setEmployeeRequests] = useState<any[]>([]);
    const [supervisorRequests, setSupervisorRequests] = useState<any[]>([]);
    // Removed hrRequests as we only use the count for the UI link.
    const [unreadMessages, setUnreadMessages] = useState<any[]>([]);

    // Modal state
    const [selectedApprovalRequest, setSelectedApprovalRequest] = useState<any>(null);

    const optimisticallyClearedChats = useRef<Set<string>>(new Set());

    // Using useCallback to prevent unnecessary re-renders in useEffect dependencies
    const fetchEmployeeNotifications = useCallback(async () => {
        if (!user || user.id === 'visitor-id') return;
        const { data, count, error } = await supabase
            .from('leave_requests')
            .select('*', { count: 'exact' })
            .eq('user_id', user.id)
            .in('status', ['rejected', 'approved'])
            .eq('is_read_by_employee', false);

        if (error) {
            console.error('AppNotifications: Error fetching employee requests:', error);
        } else if (data && data.length > 0) {
            const validIds = data.map(r => r.supervisor_id).filter(Boolean);
            const supervisorIds = [...new Set(validIds)];
            let supervisorMap: Record<string, string> = {};

            if (supervisorIds.length > 0) {
                const { data: supervisorsData } = await supabase
                    .from('profiles')
                    .select('id, full_name')
                    .in('id', supervisorIds);
                if (supervisorsData) supervisorsData.forEach(sup => { supervisorMap[sup.id] = sup.full_name; });
            }

            const formattedData = data.map(item => ({
                ...item,
                supervisor: item.supervisor_id && supervisorMap[item.supervisor_id]
                    ? { full_name: supervisorMap[item.supervisor_id] }
                    : null
            }));
            setEmployeeRequests(formattedData);
            setEmployeeUnreadCount(count || 0);
        } else {
            setEmployeeRequests([]);
            setEmployeeUnreadCount(0);
        }
    }, [user]);

    const fetchSupervisorNotifications = useCallback(async () => {
        if (!user || user.id === 'visitor-id') return;
        const { data, error } = await supabase
            .from('leave_requests')
            .select('*', { count: 'exact' })
            .eq('supervisor_id', user.id)
            .or('status.eq.pending,leave_status.eq.pending,cancellation_status.eq.pending,cut_status.eq.pending');

        if (error) {
            console.error('AppNotifications: Error fetching supervisor requests:', error);
        } else if (data && data.length > 0) {
            let activeRequests = data.filter(req => req.status === 'pending');
            const uniqueMap = new Map();
            activeRequests.forEach(req => { if (!uniqueMap.has(req.id)) uniqueMap.set(req.id, req); });
            activeRequests = Array.from(uniqueMap.values());

            if (activeRequests.length === 0) {
                setSupervisorRequests([]);
                setSupervisorPendingCount(0);
                return;
            }

            const validIds = activeRequests.map(r => r.user_id).filter(Boolean);
            const userIds = [...new Set(validIds)];
            let profileMap: Record<string, any> = {};

            if (userIds.length > 0) {
                const { data: profilesData } = await supabase.from('profiles').select('id, full_name, job_number, avatar_url').in('id', userIds);
                if (profilesData) profilesData.forEach(p => { profileMap[p.id] = p; });
            }

            const formattedData = activeRequests.map(item => ({
                ...item,
                profiles: item.user_id && profileMap[item.user_id] ? profileMap[item.user_id] : null
            }));
            setSupervisorRequests(formattedData);
            setSupervisorPendingCount(activeRequests.length);
        } else {
            setSupervisorRequests([]);
            setSupervisorPendingCount(0);
        }
    }, [user]);

    const fetchHRNotifications = useCallback(async () => {
        if (!user || user.id === 'visitor-id') return;

        // Only fetch if user is HR or developer or Muslim Aqeel
        const isAllowedRole = user.admin_role === 'developer' ||
            user.admin_role === 'hr' ||
            user.full_name?.includes('مسلم عقيل') ||
            user.full_name?.includes('مسلم قيل');

        if (!isAllowedRole) return;

        const { data, error } = await supabase
            .from('leave_requests')
            .select('id', { count: 'exact' })
            .or('status.eq.approved_by_supervisor,cancellation_status.eq.approved_by_supervisor,cut_status.eq.approved_by_supervisor');

        if (error) {
            console.error('AppNotifications: Error fetching HR requests:', error);
        } else {
            // Uniquify IDs to prevent duplicate counting and over-rendering from OR clauses
            const uniqueIds = new Set(data?.map(r => r.id));
            setHrPendingCount(uniqueIds.size || 0);
        }
    }, [user]);

    const fetchChatNotifications = useCallback(async () => {
        if (!user || user.id === 'visitor-id') return;

        // Find messages addressed to this user (not sent by them) that are unread
        // Since we don't have a direct 'recipient_id' in messages, we must find conversations the user is in.
        // Assuming messages table has 'is_read' and we just check conversations.

        // This query fetches conversations for the user
        const { data: conversations, error: convError } = await supabase
            .from('conversations')
            .select('id')
            .contains('participants', JSON.stringify([user.id]));

        if (convError || !conversations?.length) {
            setUnreadMessages([]);
            setChatUnreadCount(0);
            return;
        }

        const convIds = conversations.map(c => c.id);

        const { data: unreadMsgData, error: msgError } = await supabase
            .from('messages')
            .select('*, sender:profiles!messages_sender_id_fkey(full_name)')
            .in('conversation_id', convIds)
            .neq('sender_id', user.id)
            .eq('is_read', false)
            .order('created_at', { ascending: false });

        if (msgError) {
            console.error('AppNotifications: Error fetching chat:', msgError);
            return;
        }

        if (unreadMsgData && unreadMsgData.length > 0) {
            // Group by conversation so we only show one notification per chat
            const grouped = new Map();
            unreadMsgData.forEach(msg => {
                // Skip if this chat was optimistically cleared recently
                if (optimisticallyClearedChats.current.has(msg.conversation_id)) return;

                if (!grouped.has(msg.conversation_id)) {
                    grouped.set(msg.conversation_id, {
                        ...msg,
                        unread_count: 1
                    });
                } else {
                    const existing = grouped.get(msg.conversation_id);
                    existing.unread_count += 1;
                }
            });

            const uniqueMessages = Array.from(grouped.values());
            setUnreadMessages(uniqueMessages);
            setChatUnreadCount(uniqueMessages.length);
        } else {
            setUnreadMessages([]);
            setChatUnreadCount(0);
        }

    }, [user]);

    // Initial Fetch & Realtime Subscription
    useEffect(() => {
        if (!user || user.id === 'visitor-id') return;

        // Vercel Best Practice (async-parallel): Parallel data fetching
        Promise.all([
            fetchEmployeeNotifications(),
            fetchSupervisorNotifications(),
            fetchHRNotifications(),
            fetchChatNotifications()
        ]);

        const leaveChannel = supabase.channel('unified_leave_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => {
                fetchEmployeeNotifications();
                fetchSupervisorNotifications();
                fetchHRNotifications();
            })
            .subscribe();

        const chatChannel = supabase.channel('unified_chat_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
                fetchChatNotifications();
            })
            .subscribe();

        // Custom event so if DB realtime doesn't trigger on UPDATE, we still clear the bell
        const handleChatRead = (e: Event) => {
            const customEvent = e as CustomEvent<{ conversationId: string }>;
            if (customEvent.detail?.conversationId) {
                // Add to optimistically cleared list to suppress stale fetches
                optimisticallyClearedChats.current.add(customEvent.detail.conversationId);
                // Remove from list after 5 seconds
                setTimeout(() => {
                    optimisticallyClearedChats.current.delete(customEvent.detail.conversationId);
                }, 5000);

                // Optimistically clear the local unread count
                setUnreadMessages(prev => {
                    const updated = prev.filter(m => m.conversation_id !== customEvent.detail.conversationId);
                    setChatUnreadCount(updated.length);
                    return updated;
                });
            }
            fetchChatNotifications();
        };

        window.addEventListener('chat_read', handleChatRead);

        return () => {
            leaveChannel.unsubscribe();
            chatChannel.unsubscribe();
            window.removeEventListener('chat_read', handleChatRead);
        };
    }, [user, fetchEmployeeNotifications, fetchSupervisorNotifications, fetchHRNotifications, fetchChatNotifications]);

    const totalNotifications = employeeUnreadCount + supervisorPendingCount + (hrPendingCount > 0 ? 1 : 0) + chatUnreadCount;

    // Always show the bell so the user knows where notifications will appear
    // if (totalNotifications === 0) return null;

    // Actions
    const handleDismissEmployeeNotification = async (requestId: string) => {
        try {
            const { error } = await supabase.from('leave_requests').update({ is_read_by_employee: true }).eq('id', requestId);
            if (error) throw error;
            const updated = employeeRequests.filter(r => r.id !== requestId);
            setEmployeeRequests(updated);
            setEmployeeUnreadCount(updated.length);
            if (totalNotifications - 1 === 0) setShowModal(false);
        } catch (err) { }
    };

    const handleDismissAllEmployee = async () => {
        try {
            const ids = employeeRequests.map(r => r.id);
            const { error } = await supabase.from('leave_requests').update({ is_read_by_employee: true }).in('id', ids);
            if (error) throw error;
            setEmployeeRequests([]);
            setEmployeeUnreadCount(0);
            if (totalNotifications - employeeUnreadCount === 0) setShowModal(false);
        } catch (err) { }
    };

    const handleOpenChat = (conversationId: string) => {
        // Optimistically clear the local unread count
        const updatedMessages = unreadMessages.filter(m => m.conversation_id !== conversationId);
        setUnreadMessages(updatedMessages);
        setChatUnreadCount(updatedMessages.length);

        setShowModal(false);
        navigate(`/chat/${conversationId}`);
    };

    const handleGoToAdminRequests = () => {
        setShowModal(false);
        // Dispatching custom event for Dashboard/AdminDashboard layout to handle tab switching
        const event = new CustomEvent('navigate_to_hr_requests');
        window.dispatchEvent(event);
    };

    return (
        <>
            <button
                onClick={() => setShowModal(true)}
                className="fixed bottom-[104px] left-[100px] z-[100] bg-white dark:bg-slate-800 p-2.5 rounded-full shadow-2xl border-2 border-indigo-500 animate-pulse group transition-transform hover:scale-110"
                title="الإشعارات الشاملة"
            >
                <div className="relative">
                    <Bell className="text-gray-700 dark:text-gray-200" size={20} />
                    <span className="absolute -top-2 -right-2 w-[18px] h-[18px] bg-indigo-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce shadow">
                        {totalNotifications}
                    </span>
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-indigo-500/50 animate-ping pointer-events-none"></div>
            </button>

            {showModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-5">
                        {/* Header */}
                        <div className="bg-indigo-600 p-4 text-white flex justify-between items-center shrink-0">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <Bell size={20} />
                                الإشعارات ({totalNotifications})
                            </h3>
                            <button onClick={() => setShowModal(false)} className="hover:bg-white/20 p-1 rounded-xl transition">
                                <X size={20} />
                            </button>
                        </div>

                        {/* List */}
                        <div className="overflow-y-auto p-4 flex-1 space-y-4 custom-scrollbar bg-slate-50 dark:bg-slate-900/50">

                            {totalNotifications === 0 && (
                                <div className="flex flex-col items-center justify-center p-8 text-center opacity-70">
                                    <div className="w-16 h-16 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                                        <Bell size={28} className="text-slate-400 dark:text-slate-500" />
                                    </div>
                                    <h4 className="font-bold text-slate-600 dark:text-slate-300 mb-1">لا توجد إشعارات جديدة</h4>
                                    <p className="text-xs text-slate-500">أنت على إطلاع بكل جديد، استمتع بيومك!</p>
                                </div>
                            )}

                            {/* Chat Messages Section */}
                            {unreadMessages.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 border-b pb-1 dark:border-slate-700">رسائل جديدة</h4>
                                    {unreadMessages.map(msg => (
                                        <div
                                            key={msg.id}
                                            onClick={() => handleOpenChat(msg.conversation_id)}
                                            className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-indigo-100 dark:border-indigo-900/50 shadow-sm cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors flex items-start gap-3 relative overflow-hidden"
                                        >
                                            <div className="absolute top-0 right-0 w-1 h-full bg-indigo-500"></div>
                                            <div className="bg-indigo-100 dark:bg-indigo-900/50 p-2 rounded-full shrink-0">
                                                <MessageCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h5 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                                                    لديك {msg.unread_count > 1 ? `${msg.unread_count} رسائل` : 'رسالة'} من {msg.sender?.full_name || 'مستخدم غير معروف'}
                                                </h5>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
                                                    انقر لفتح المحادثة والرد الآن
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Supervisor Requests Section */}
                            {supervisorRequests.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 border-b pb-1 dark:border-slate-700">طلبات إجازة بانتظار موافقتك</h4>
                                    {supervisorRequests.map(req => (
                                        <div
                                            key={req.id}
                                            onClick={() => { setShowModal(false); setSelectedApprovalRequest(req); }}
                                            className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-amber-200 dark:border-amber-900/50 shadow-sm cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors flex justify-between items-center"
                                        >
                                            <div className="flex-1">
                                                <h5 className="font-bold text-sm text-slate-900 dark:text-white">
                                                    {req.profiles?.full_name || 'موظف'}
                                                </h5>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                    طالب بإجازة {req.leave_type} لمدة {req.days_count} يوم
                                                </p>
                                            </div>
                                            <button
                                                className="bg-amber-100 hover:bg-amber-200 text-amber-700 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 dark:text-amber-400 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ml-2 shrink-0 pointer-events-none"
                                            >
                                                مراجعة
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* HR Dashboard Link */}
                            {hrPendingCount > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 border-b pb-1 dark:border-slate-700">إشعارات الموارد البشرية</h4>
                                    <div
                                        onClick={handleGoToAdminRequests}
                                        className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800/50 cursor-pointer hover:shadow-md transition-all text-center group"
                                    >
                                        <h5 className="font-bold text-blue-700 dark:text-blue-400 group-hover:underline">
                                            يوجد {hrPendingCount} طلب إجازة مكتمل الموافقات وبانتظار أمر إداري
                                        </h5>
                                        <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">
                                            النقر هنا سينقلك لقسم الطلبات
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Employee Personal Responses Section */}
                            {employeeRequests.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 border-b pb-1 dark:border-slate-700">الردود على طلباتك</h4>
                                    {employeeRequests.map(req => {
                                        const isApproved = req.status === 'approved';
                                        return (
                                            <div key={req.id} className={`bg-white dark:bg-slate-800 border rounded-xl p-3 relative ${isApproved ? 'border-emerald-200 dark:border-emerald-800/50' : 'border-rose-200 dark:border-rose-800/50'} shadow-sm`}>
                                                <div className="mb-2">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded inline-block mb-1 ${isApproved ? 'text-emerald-700 bg-emerald-100 dark:bg-emerald-900/50 dark:text-emerald-400' : 'text-rose-700 bg-rose-100 dark:bg-rose-900/50 dark:text-rose-400'}`}>
                                                        {isApproved ? 'موافق عليه' : 'مرفوض'}
                                                    </span>
                                                    <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                                                        لقد تم <span className={isApproved ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-rose-600 dark:text-rose-400 font-bold"}>{isApproved ? 'الموافقة على' : 'رفض'}</span> طلب إجازتك (من <span className="dir-ltr inline-block mx-0.5 font-mono">{req.start_date}</span> إلى <span className="dir-ltr inline-block mx-0.5 font-mono">{req.end_date}</span>).
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleDismissEmployeeNotification(req.id)}
                                                    className="w-full mt-2 py-1.5 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 transition flex items-center justify-center gap-1.5"
                                                >
                                                    <CheckCircle size={14} className="text-slate-400" />
                                                    علم (إخفاء)
                                                </button>
                                            </div>
                                        );
                                    })}
                                    {employeeRequests.length > 1 && (
                                        <button
                                            onClick={handleDismissAllEmployee}
                                            className="w-full text-center text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 py-2 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl"
                                        >
                                            إخفاء جميع الردود
                                        </button>
                                    )}
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}

            {/* Render Supervisor Approval Modal Outside Main Dialog so it doesn't pile modals */}
            {selectedApprovalRequest && (
                <ApprovalModal
                    request={selectedApprovalRequest}
                    onClose={() => setSelectedApprovalRequest(null)}
                    onProcessed={() => {
                        fetchSupervisorNotifications();
                    }}
                />
            )}
        </>
    );
};
