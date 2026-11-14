import React from 'react';
import { CalendarCheck, Stethoscope, Clock, UserX, CalendarDays, ShieldCheck } from 'lucide-react';

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
  unpaidLeavesTotal?: number;
  expiryDate?: string;
  isLoading?: boolean;
}

export const LeaveBalanceCard: React.FC<LeaveBalanceCardProps> = ({
  leaveType,
  regularBalance = 0,
  sickBalance = 0,
  unpaidLeavesTotal = 0,
  expiryDate,
  isLoading = false
}) => {
  if (!leaveType) return null;

  if (isLoading) {
    return (
      <div className="w-full h-24 rounded-2xl bg-slate-100 dark:bg-slate-800/60 animate-pulse border border-slate-200/60 dark:border-slate-700/50"></div>
    );
  }

  const isRegular = leaveType === 'regular' || leaveType === 'long_regular';
  const isNonConsuming = leaveType === 'time_off' || leaveType === 'dispatch' || leaveType === 'duty';

  if (isNonConsuming) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-2xl bg-slate-50/90 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-700/80 transition-all duration-300">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-slate-200/60 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300">
            <Clock size={18} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
              طلب إداري مباشر
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              هذا النوع لا يستهلك من رصيد الإجازات
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* عداد الغياب المثبت */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700/80 border border-slate-200/70 dark:border-slate-600 text-[11px]">
            <UserX size={14} className={unpaidLeavesTotal > 0 ? 'text-rose-500' : 'text-slate-400'} />
            <span className="text-slate-500 dark:text-slate-400">الغياب المثبت:</span>
            <span className={`font-black ${unpaidLeavesTotal > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-200'}`}>
              {unpaidLeavesTotal} يوم
            </span>
          </div>

          {expiryDate && (
            <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700/80 border border-slate-200/70 dark:border-slate-600 text-[11px] text-slate-500 dark:text-slate-400">
              <CalendarDays size={13} className="text-slate-400" />
              <span>مُحتسب لغاية: <strong className="font-bold text-slate-700 dark:text-slate-200">{expiryDate}</strong></span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl bg-white dark:bg-slate-850/90 border border-slate-200/80 dark:border-slate-700/80 shadow-sm p-3 sm:p-3.5 transition-all duration-300">
      {/* ── الترويسة المدمجة: عنوان الكارت + تاريخ الاحتساب في سطر واحد ── */}
      <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-100 dark:border-slate-750">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
          <ShieldCheck size={16} className="text-blue-600 dark:text-blue-400" />
          <span>حالة الأرصدة وسجل الغياب المعتمد</span>
        </div>

        {expiryDate && (
          <div className="flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100/90 dark:bg-slate-800 px-2.5 py-0.5 rounded-lg border border-slate-200/70 dark:border-slate-700/60">
            <CalendarDays size={12} className="text-slate-500 dark:text-slate-400" />
            <span>مُحتسب لغاية: <strong className="font-bold text-slate-900 dark:text-white">{expiryDate}</strong></span>
          </div>
        )}
      </div>

      {/* ── شبكة الأرصدة الثلاثية المدمجة المتوازنة ── */}
      <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
        {/* 1. رصيد الإجازات الاعتيادية */}
        <div className={`p-2.5 rounded-xl border transition-all ${
          isRegular
            ? 'bg-blue-50/80 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/60 shadow-sm ring-1 ring-blue-400/40'
            : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-700/50'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-blue-900 dark:text-blue-300 truncate">رصيد الاعتيادية</span>
            <div className="w-5 h-5 rounded-md bg-blue-500/15 dark:bg-blue-500/25 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <CalendarCheck size={12} />
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black text-blue-700 dark:text-blue-400">{regularBalance}</span>
            <span className="text-[10px] sm:text-xs font-bold text-blue-600/80 dark:text-blue-400/80">يوم</span>
          </div>
        </div>

        {/* 2. رصيد الإجازات المرضية */}
        <div className={`p-2.5 rounded-xl border transition-all ${
          !isRegular
            ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 shadow-sm ring-1 ring-emerald-400/40'
            : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-700/50'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-emerald-900 dark:text-emerald-300 truncate">الرصيد المرضي</span>
            <div className="w-5 h-5 rounded-md bg-emerald-500/15 dark:bg-emerald-500/25 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Stethoscope size={12} />
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-400">{sickBalance}</span>
            <span className="text-[10px] sm:text-xs font-bold text-emerald-600/80 dark:text-emerald-400/80">يوم</span>
          </div>
        </div>

        {/* 3. أيام الغياب المثبتة */}
        <div className={`p-2.5 rounded-xl border transition-all ${
          unpaidLeavesTotal > 0
            ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 shadow-sm'
            : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-700/50'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-300 truncate">الغياب المثبت</span>
            <div className={`w-5 h-5 rounded-md flex items-center justify-center ${
              unpaidLeavesTotal > 0 
                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400' 
                : 'bg-slate-500/10 text-slate-500 dark:text-slate-400'
            }`}>
              <UserX size={12} />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-1">
            <div className="flex items-baseline gap-1">
              <span className={`text-xl sm:text-2xl font-black ${
                unpaidLeavesTotal > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-white'
              }`}>
                {unpaidLeavesTotal}
              </span>
              <span className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400">يوم</span>
            </div>
            {unpaidLeavesTotal === 0 ? (
              <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-900/40 px-1 py-0.5 rounded">
                نظيف
              </span>
            ) : (
              <span className="text-[9px] font-bold text-rose-700 dark:text-rose-300 bg-rose-100/80 dark:bg-rose-900/40 px-1 py-0.5 rounded">
                بدون راتب
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
