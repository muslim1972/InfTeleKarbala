import { Calendar, Stethoscope, Plane, Briefcase, Clock, FileMinus } from 'lucide-react';

interface LeaveTypeBadgeProps {
    type?: string;
    cancellationStatus?: string;
}

export function LeaveTypeBadge({ type, cancellationStatus }: LeaveTypeBadgeProps) {
    if (cancellationStatus === 'approved') {
        return <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded text-xs font-bold ring-1 ring-rose-500/30">إجازة ملغاة</span>;
    }

    switch (type) {
        case 'regular':
        case 'long_regular':
            return (
                <span className="flex items-center gap-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-1 rounded text-xs font-bold ring-1 ring-blue-500/30">
                    <Calendar size={12} />
                    {type === 'long_regular' ? 'اعتيادية (طويلة)' : 'اعتيادية'}
                </span>
            );
        case 'sick':
        case 'long_sick':
            return (
                <span className="flex items-center gap-1 bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 px-2 py-1 rounded text-xs font-bold ring-1 ring-rose-500/30">
                    <Stethoscope size={12} />
                    {type === 'long_sick' ? 'مرضية (طويلة)' : 'مرضية'}
                </span>
            );
        case 'dispatch':
            return (
                <span className="flex items-center gap-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 px-2 py-1 rounded text-xs font-bold ring-1 ring-purple-500/30">
                    <Plane size={12} /> إيفاد
                </span>
            );
        case 'duty':
            return (
                <span className="flex items-center gap-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-1 rounded text-xs font-bold ring-1 ring-amber-500/30">
                    <Briefcase size={12} /> مهمة رسمية
                </span>
            );
        case 'time_off':
            return (
                <span className="flex items-center gap-1 bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 px-2 py-1 rounded text-xs font-bold ring-1 ring-teal-500/30">
                    <Clock size={12} /> إجازة زمنية
                </span>
            );
        case 'unpaid':
            return (
                <span className="flex items-center gap-1 bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 px-2 py-1 rounded text-xs font-bold ring-1 ring-gray-500/30">
                    <FileMinus size={12} /> بدون راتب
                </span>
            );
        default:
            return (
                <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded text-xs font-bold ring-1 ring-green-500/30">معتمد</span>
            );
    }
}
