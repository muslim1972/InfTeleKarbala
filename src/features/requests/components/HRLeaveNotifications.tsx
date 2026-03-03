import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';

interface HRLeaveNotificationsProps {
    onNavigateToRequests?: () => void;
}

export const HRLeaveNotifications = ({ onNavigateToRequests }: HRLeaveNotificationsProps) => {
    const { user } = useAuth();
    const [approvedCount, setApprovedCount] = useState(0);

    const fetchApprovedCount = async () => {
        if (!user || user.id === 'visitor-id') {
            console.log('HRLeaveNotifications: Skipping - no user or visitor');
            return;
        }

        console.log('HRLeaveNotifications: Fetching approved count for user:', user.id, user.full_name);

        const { count, error } = await supabase
            .from('leave_requests')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'approved');

        console.log('HRLeaveNotifications: Result - count:', count, 'error:', error);

        if (error) {
            console.error('HRLeaveNotifications: Error fetching:', error);
        } else {
            setApprovedCount(count || 0);
        }
    };

    useEffect(() => {
        if (!user || user.id === 'visitor-id') return;

        fetchApprovedCount();

        // Subscribe to changes (Realtime) — same pattern as SupervisorNotifications
        const subscription = supabase
            .channel('leave_requests_hr_approved')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'leave_requests',
            }, () => {
                fetchApprovedCount();
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [user]);

    const handleClick = () => {
        if (onNavigateToRequests) {
            onNavigateToRequests();
        }
    };

    if (approvedCount === 0) return null;

    return (
        <button
            onClick={handleClick}
            className="fixed bottom-[104px] left-[100px] z-[100] bg-white dark:bg-slate-800 p-2.5 rounded-full shadow-2xl border-2 border-green-500 animate-pulse group"
            title="طلبات إجازة معتمدة بانتظار المعالجة"
        >
            <div className="relative">
                <Bell className="text-gray-700 dark:text-gray-200" size={20} />
                <span className="absolute -top-2 -right-2 w-5 h-5 bg-green-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce">
                    {approvedCount}
                </span>
            </div>
            {/* Pulsing Ring — same as SupervisorNotifications */}
            <div className="absolute inset-0 rounded-full border-2 border-green-500/50 animate-ping pointer-events-none"></div>
        </button>
    );
};
