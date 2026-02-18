import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { ApprovalModal } from './ApprovalModal';

export const AdminNotifications = () => {
    const { user } = useAuth();
    const [pendingCount, setPendingCount] = useState(0);
    const [pendingRequests, setPendingRequests] = useState<any[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<any>(null);

    const fetchPendingRequests = async () => {
        if (!user) return;

        // Fetch requests where supervisor_id matches current user AND status is pending
        const { data, count } = await supabase
            .from('leave_requests')
            .select('*, profiles:user_id(full_name, job_number, avatar_url)', { count: 'exact' })
            .eq('supervisor_id', user.id)
            .eq('status', 'pending');

        if (data) {
            setPendingRequests(data);
            setPendingCount(count || 0);
        }
    };

    useEffect(() => {
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

    if (pendingCount === 0) return null;

    return (
        <>
            <button
                onClick={handleNotificationClick}
                className="fixed top-24 left-6 z-50 bg-white dark:bg-slate-800 p-3 rounded-full shadow-lg border border-gray-200 dark:border-slate-700 animate-pulse group"
                title="طلبات معلقة"
            >
                <div className="relative">
                    <Bell className="text-gray-700 dark:text-gray-200" size={24} />
                    <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-bounce">
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
