import React from 'react';
import { Stethoscope, Clock } from 'lucide-react';

export type LeaveType = 
  | 'regular' 
  | 'long_regular' 
  | 'sick' 
  | 'long_sick' 
  | 'time_off' 
  | 'dispatch' 
  | 'duty';

export interface LeaveBalanceCardProps {
  leaveType?: LeaveType;
  regularBalance?: number;
  sickBalance?: number;
  expiryDate?: string;
  isLoading?: boolean;
}

function CalendarCheck({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg 
      xmlns='http://www.w3.org/2000/svg' 
      width={size} 
      height={size} 
      viewBox='0 0 24 24' 
      fill='none' 
      stroke='currentColor' 
      strokeWidth='2' 
      strokeLinecap='round' 
      strokeLinejoin='round' 
      className={className}
    >
      <rect width='18' height='18' x='3' y='4' rx='2' ry='2' />
      <line x1='16' x2='16' y1='2' y2='6' />
      <line x1='8' x2='8' y1='2' y2='6' />
      <line x1='3' x2='21' y1='10' y2='10' />
      <path d='m9 16 2 2 4-4' />
    </svg>
  );
}

export const LeaveBalanceCard: React.FC<LeaveBalanceCardProps> = ({
  leaveType,
  regularBalance = 0,
  sickBalance = 0,
  expiryDate,
  isLoading = false
}) => {
  if (!leaveType) return null;

  if (isLoading) {
    return (
      <div className="w-full h-32 rounded-2xl bg-gray-200 dark:bg-gray-800 animate-pulse shadow-sm"></div>
    );
  }

  const isRegular = leaveType === 'regular' || leaveType === 'long_regular';
  const isSick = leaveType === 'sick' || leaveType === 'long_sick';
  const isNonConsuming = leaveType === 'time_off' || leaveType === 'dispatch' || leaveType === 'duty';

  if (isNonConsuming) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 transition-all duration-300">
        <div className="p-2 rounded-lg bg-gray-200/50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400">
          <Clock size={20} />
        </div>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
          هذا النوع لا يستهلك من رصيد الإجازات
        </p>
      </div>
    );
  }

  const balance = isRegular ? regularBalance : sickBalance;
  const title = isRegular ? 'رصيد الإجازات الاعتيادية' : 'رصيد الإجازات المرضية';
  
  // RTL-friendly gradients (to-r will be to-left in RTL mode if tailwind is configured correctly for ltr/rtl, 
  // but to-r with tailwind 3 typically means left-to-right. We will just use it as requested.)
  const gradientClass = isRegular 
    ? 'from-blue-500 to-indigo-600 dark:from-blue-600 dark:to-indigo-800' 
    : 'from-emerald-400 to-green-600 dark:from-emerald-600 dark:to-green-800';
  
  const Icon = isRegular ? CalendarCheck : Stethoscope;

  return (
    <div className={`relative overflow-hidden rounded-2xl p-6 text-white shadow-lg bg-gradient-to-r ${gradientClass} transition-all duration-300 hover:shadow-xl hover:-translate-y-1`}>
      {/* Background Decoration */}
      <div className="absolute -top-10 -end-10 opacity-10 pointer-events-none transform -scale-x-100 rtl:scale-x-100">
        <Icon size={120} />
      </div>
      
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl shadow-inner">
            <Icon size={28} className="text-white" />
          </div>
          <div>
            <h3 className="text-white/90 text-sm font-medium mb-1">{title}</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold tracking-tight">{balance}</span>
              <span className="text-white/80 font-medium">يوم</span>
            </div>
          </div>
        </div>
      </div>

      {expiryDate && (
        <div className="relative z-10 mt-4 pt-4 border-t border-white/20">
          <p className="text-xs text-white/80 flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-white/70"></span>
            صالح حتى: {expiryDate}
          </p>
        </div>
      )}
    </div>
  );
};
