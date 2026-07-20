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
            supabase.removeChannel(subscription).catch(() => {});
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
            className="fixed bottom-[136px] left-3 md:bottom-[152px] md:left-4 z-[100] bg-white dark:bg-slate-800 w-12 h-12 md:w-14 md:h-14 rounded-full shadow-2xl border-2 border-green-500 transition-all duration-300 transform hover:scale-110 active:scale-95 group p-0 flex items-center justify-center focus:outline-none"
            title="طلبات إجازة معتمدة بانتظار المعالجة"
        >
            <div className="relative w-full h-full flex items-center justify-center">
                <Bell className="text-gray-700 dark:text-gray-200" size={24} />
                <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 bg-green-600 text-white text-[11px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-lg animate-bounce">
                    {approvedCount > 99 ? '99+' : approvedCount}
                </span>
            </div>
            {/* Pulsing Ring — same as SupervisorNotifications */}
            <div className="absolute inset-0 rounded-full border-[3px] border-green-500/50 animate-pulse pointer-events-none"></div>
        </button>
    );
};
