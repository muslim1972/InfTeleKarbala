import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { ApprovalModal } from './ApprovalModal';

export const SupervisorNotifications = () => {
    const { user } = useAuth();
    const [pendingCount, setPendingCount] = useState(0);
    const [pendingRequests, setPendingRequests] = useState<any[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<any>(null);

    const fetchPendingRequests = async () => {
        if (!user || user.id === 'visitor-id') {
            console.log('AdminNotifications: No user or is visitor');
            return;
        }

        console.log('AdminNotifications: Fetching for supervisor:', user.id);

        // Fetch requests where supervisor_id matches current user AND any status is pending
        const { data, count, error } = await supabase
            .from('leave_requests')
            .select('*', { count: 'exact' })
            .eq('supervisor_id', user.id)
            .or('status.eq.pending,leave_status.eq.pending,cancellation_status.eq.pending,cut_status.eq.pending');

        if (error) {
            console.error('AdminNotifications: Error fetching:', error);
        } else if (data && data.length > 0) {
            console.log('AdminNotifications: Found requests:', data.length, 'Count:', count);

            // Secondary query to fetch user profiles
            const validIds = data.map(r => r.user_id).filter(Boolean);
            const userIds = [...new Set(validIds)];
            let profileMap: Record<string, { full_name: string; job_number?: string; avatar_url?: string }> = {};

            if (userIds.length > 0) {
                const { data: profilesData } = await supabase
                    .from('profiles')
                    .select('id, full_name, job_number, avatar_url')
                    .in('id', userIds);

                if (profilesData) {
                    profilesData.forEach(p => {
                        profileMap[p.id] = p;
                    });
                }
            }

            const formattedData = data.map(item => ({
                ...item,
                profiles: item.user_id && profileMap[item.user_id]
                    ? profileMap[item.user_id]
                    : null
            }));

            setPendingRequests(formattedData);
            setPendingCount(count || 0);
        } else {
            console.log('AdminNotifications: Found requests: 0 Count:', count || 0);
            setPendingRequests([]);
            setPendingCount(0);
        }
    };

    useEffect(() => {
        if (!user || user.id === 'visitor-id') return;

        fetchPendingRequests();

        // Subscribe to changes (Realtime)
        const subscription = supabase
            .channel('leave_requests_changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'leave_requests',
                filter: `supervisor_id=eq.${user?.id}`
            }, () => {
                fetchPendingRequests();
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [user]);

    const handleNotificationClick = () => {
        if (pendingRequests.length > 0) {
            // Open modal for the first request (FIFO) or show a list (Simplified to show first for now)
            // Ideally, we show a list, but user requirement is "click -> open modal"
            // Let's open the first one.
            setSelectedRequest(pendingRequests[0]);
            setShowModal(true);
        }
    };

    console.log('AdminNotifications: Render. Pending count:', pendingCount);

    if (pendingCount === 0) return null;

    return (
        <>
            <button
                onClick={handleNotificationClick}
                className="fixed bottom-[104px] left-[100px] z-[100] bg-white dark:bg-slate-800 p-2.5 rounded-full shadow-2xl border-2 border-red-500 animate-pulse group"
                title="طلبات معلقة"
            >
                <div className="relative">
                    <Bell className="text-gray-700 dark:text-gray-200" size={20} />
                    <span className="absolute -top-2 -right-2 w-4 h-4 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce">
                        {pendingCount}
                    </span>
                </div>
                {/* Pulsing Ring */}
                <div className="absolute inset-0 rounded-full border-2 border-red-500/50 animate-ping pointer-events-none"></div>
            </button>

            {showModal && selectedRequest && (
                <ApprovalModal
                    request={selectedRequest}
                    onClose={() => setShowModal(false)}
                    onProcessed={() => {
                        fetchPendingRequests(); // Refresh list logic handled by realtime usually, but forced refresh is good
                    }}
                />
            )}
        </>
    );
};
