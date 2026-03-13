import { useState, useEffect } from 'react';
import { Bell, X, CheckCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';

export const EmployeeNotifications = () => {
    const { user } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);
    const [unreadRequests, setUnreadRequests] = useState<any[]>([]);
    const [showModal, setShowModal] = useState(false);

    const fetchNotifications = async () => {
        if (!user || user.id === 'visitor-id') return;

        // Fetch requests where user_id matches current user AND status is rejected/approved AND is_read_by_employee is false
        const { data, count, error } = await supabase
            .from('leave_requests')
            .select('*', { count: 'exact' })
            .eq('user_id', user.id)
            .in('status', ['rejected', 'approved'])
            .eq('is_read_by_employee', false);

        if (error) {
            console.error('EmployeeNotifications: Error fetching:', error);
        } else if (data && data.length > 0) {
            // Secondary query to fetch supervisor names to avoid foreign key relation errors (PGRST200)
            const validIds = data.map(r => r.supervisor_id).filter(Boolean);
            const supervisorIds = [...new Set(validIds)];
            let supervisorMap: Record<string, string> = {};

            if (supervisorIds.length > 0) {
                const { data: supervisorsData } = await supabase
                    .from('profiles')
                    .select('id, full_name')
                    .in('id', supervisorIds);

                if (supervisorsData) {
                    supervisorsData.forEach(sup => {
                        supervisorMap[sup.id] = sup.full_name;
                    });
                }
            }

            const formattedData = data.map(item => ({
                ...item,
                supervisor: item.supervisor_id && supervisorMap[item.supervisor_id]
                    ? { full_name: supervisorMap[item.supervisor_id] }
                    : null
            }));

            // Sort so newest is at the top, or default from DB (usually chronological)
            setUnreadRequests(formattedData);
            setUnreadCount(count || 0);
        } else {
            setUnreadRequests([]);
            setUnreadCount(0);
        }
    };

    useEffect(() => {
        if (!user || user.id === 'visitor-id') return;

        fetchNotifications();

        // Subscribe to changes (Realtime)
        const subscription = supabase
            .channel('leave_requests_employee_changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'leave_requests',
                filter: `user_id=eq.${user?.id}`
            }, () => {
                fetchNotifications();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription).catch(() => {});
        };
    }, [user]);

    const handleNotificationClick = () => {
        if (unreadRequests.length > 0) {
            setShowModal(true);
        }
    };

    const handleDismiss = async (requestId: string) => {
        try {
            const { error } = await supabase
                .from('leave_requests')
                .update({ is_read_by_employee: true })
                .eq('id', requestId);

            if (error) throw error;

            // local update
            const updated = unreadRequests.filter(r => r.id !== requestId);
            setUnreadRequests(updated);
            setUnreadCount(updated.length);

            if (updated.length === 0) {
                setShowModal(false);
            }
        } catch (err) {
            console.error("Error dismissing notification:", err);
        }
    };

    const handleDismissAll = async () => {
        try {
            const ids = unreadRequests.map(r => r.id);
            const { error } = await supabase
                .from('leave_requests')
                .update({ is_read_by_employee: true })
                .in('id', ids);

            if (error) throw error;

            setUnreadRequests([]);
            setUnreadCount(0);
            setShowModal(false);
        } catch (err) {
            console.error("Error dismissing all:", err);
        }
    };

    if (unreadCount === 0) return null;

    return (
        <>
            <button
                onClick={handleNotificationClick}
                className="fixed bottom-[104px] left-[100px] z-[100] bg-white dark:bg-slate-800 p-2.5 rounded-full shadow-2xl border-2 border-blue-500 animate-pulse group"
                title="إشعارات الإجازات"
            >
                <div className="relative">
                    <Bell className="text-gray-700 dark:text-gray-200" size={20} />
                    <span className="absolute -top-2 -right-2 w-4 h-4 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce">
                        {unreadCount}
                    </span>
                </div>
                {/* Pulsing Ring for Employee */}
                <div className="absolute inset-0 rounded-full border-2 border-blue-500/50 animate-ping pointer-events-none"></div>
            </button>

            {showModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                        {/* Header */}
                        <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <Bell size={20} />
                                إشعارات الإجازات ({unreadCount})
                            </h3>
                            <button onClick={() => setShowModal(false)} className="hover:bg-white/20 p-1 rounded-xl transition">
                                <X size={20} />
                            </button>
                        </div>

                        {/* List */}
                        <div className="overflow-y-auto p-4 flex-1 space-y-3 custom-scrollbar">
                            {unreadRequests.map(req => {
                                const isApproved = req.status === 'approved';
                                return (
                                    <div key={req.id} className={`border rounded-xl p-4 relative ${isApproved ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/50' : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/50'}`}>
                                        <div className="mb-2">
                                            <span className={`text-xs font-bold px-2 py-1 rounded inline-block mb-2 ${isApproved ? 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/50' : 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/50'}`}>
                                                {isApproved ? 'طلب موافق عليه' : 'طلب مرفوض'}
                                            </span>
                                            <p className="text-sm text-gray-800 dark:text-gray-200 font-medium leading-relaxed">
                                                لقد تمت <span className={isApproved ? "text-green-600 dark:text-green-400 font-bold" : "text-orange-600 dark:text-orange-400 font-bold"}>{isApproved ? 'الموافقة على' : 'رفض'}</span> طلب الإجازة الخاص بك من تاريخ <span className="dir-ltr inline-block mx-1 font-mono">{req.start_date}</span> إلى <span className="dir-ltr inline-block mx-1 font-mono">{req.end_date}</span> (المدة: {req.days_count} يوم).
                                            </p>
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-4 bg-white/50 dark:bg-black/20 p-2 rounded border border-gray-100 dark:border-slate-700">
                                            المسؤول الذي قام بالرد: <span className="font-bold text-gray-800 dark:text-gray-200">{req.supervisor?.full_name || 'غير محدد'}</span>
                                        </div>

                                        <button
                                            onClick={() => handleDismiss(req.id)}
                                            className="w-full text-center py-2.5 bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 border border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-300 transition flex items-center justify-center gap-2 shadow-sm"
                                        >
                                            <CheckCircle size={18} className="text-gray-500" />
                                            علم (إخفاء الإشعار)
                                        </button>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Footer */}
                        {unreadRequests.length > 1 && (
                            <div className="p-4 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 text-center">
                                <button
                                    onClick={handleDismissAll}
                                    className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-bold flex items-center justify-center gap-1 mx-auto"
                                >
                                    <CheckCircle size={14} /> تحديد الكل كمقروء
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};
