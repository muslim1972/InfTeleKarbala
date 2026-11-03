import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { getServerNow } from '../services/serverTimeService';
import { baghdadDateStr, arabicDayNameForDate } from '../../../lib/attendanceHelpers';

interface CompactLiveClockProps {
  className?: string;
}

/**
 * بطاقة الوقت والتاريخ الرسمية المدمجة
 * تُعرض في واجهة تثبيت الحضور والانصراف للموظف
 * تعتمد على التوقيت الرسمي للخادم المحصن (getServerNow)
 */
export default function CompactLiveClock({ className = '' }: CompactLiveClockProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const now = getServerNow();
  const dateStr = baghdadDateStr(now);
  const dayName = arabicDayNameForDate(dateStr);

  const timeStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Baghdad',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(now);

  return (
    <div
      className={`shrink-0 flex items-center gap-2.5 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm px-3.5 py-2 rounded-xl shadow-sm border border-emerald-100 dark:border-slate-700/80 transition-all ${className}`}
    >
      <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
        <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
      </div>

      {/* الوقت الرسمي */}
      <div className="flex flex-col leading-none">
        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mb-0.5">
          الوقت الرسمي
        </span>
        <span
          className="text-sm font-black font-mono text-slate-800 dark:text-white leading-tight tabular-nums tracking-tight"
          dir="ltr"
        >
          {timeStr}
        </span>
      </div>

      {/* فاصل ناعم */}
      <div className="h-7 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

      {/* اليوم والتاريخ */}
      <div className="flex flex-col items-center leading-none">
        <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 leading-none mb-1">
          {dayName}
        </span>
        <span
          className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400 leading-none"
          dir="ltr"
        >
          {dateStr}
        </span>
      </div>
    </div>
  );
}
