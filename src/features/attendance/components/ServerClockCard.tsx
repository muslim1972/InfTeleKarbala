import { useEffect, useState } from 'react';
import { Clock, ShieldCheck, ShieldAlert, Wifi, WifiOff } from 'lucide-react';
import { getServerNow } from '../services/serverTimeService';
import { useServerTime } from '../hooks/useServerTime';
import { baghdadDateStr, arabicDayNameForDate } from '../../../lib/attendanceHelpers';

/**
 * بطاقة الوقت الرسمي — واجهة تثبيت الحضور والانصراف (المستخدم العادي).
 *
 * مبدأ أمني (عدم ثقة العميل):
 * - التوقيت هنا **ليس** ساعة الجهاز. مصدره `getServerNow()` الذي يُعاير
 *   بـ `get_server_time` RPC (أو ترويسة HTTP Date) ثم يتقدّم بساعة أحادية
 *   (`performance.now()`) — أي أن تغيير ساعة الهاتف/الكمبيوتر لا يؤثر.
 * - إن رُصد فارق > 90 ثانية بين ساعة الجهاز والتوقيت الرسمي، تُعرض تحذير
 *   صريح للمستخدم ويُعلَم أن التوقيت المعتمد هو رسمية الشبكة.
 *
 * سبب التواجد: المستخدم يحتاج أن يرى "الوقت الرسمي" قبل أن يبصم، ليعلم
 * السجلعة التي ستُحفظ بهذه الدقيقة بالضبط، وأن يتأكد أن جهازه لم يُعبث بساعته.
 */
export default function ServerClockCard() {
    const { isTampered, tamperInfo, forceSync } = useServerTime();

    // نبضة عرض كل ثانية — القيمة المعروضة تأتي من getServerNow() لا من Date.now()
    const [, setTick] = useState(0);
    const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

    useEffect(() => {
        const timer = window.setInterval(() => setTick(t => t + 1), 1000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        const on = () => setIsOnline(true);
        const off = () => setIsOnline(false);
        window.addEventListener('online', on);
        window.addEventListener('offline', off);
        return () => {
            window.removeEventListener('online', on);
            window.removeEventListener('offline', off);
        };
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
            className={`rounded-2xl border p-4 shadow-sm ${
                isTampered
                    ? 'bg-amber-50 dark:bg-amber-950/25 border-amber-300 dark:border-amber-800'
                    : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700/50'
            }`}
        >
            <div className="flex items-center justify-between gap-3 flex-wrap">
                {/* الوقت والتاريخ */}
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center shrink-0">
                        <Clock className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="flex flex-col leading-none">
                        <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mb-1">
                            الوقت الرسمي للشبكة
                        </span>
                        <div className="flex items-baseline gap-2">
                            <span
                                className="text-2xl font-bold font-mono text-slate-800 dark:text-white tabular-nums"
                                dir="ltr"
                            >
                                {timeStr}
                            </span>
                            <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                                {dayName}
                            </span>
                        </div>
                        <span
                            className="text-[11px] font-mono text-slate-400 dark:text-slate-500 mt-1"
                            dir="ltr"
                        >
                            {dateStr}
                        </span>
                    </div>
                </div>

                {/* حالة المصدر */}
                <div className="flex items-center gap-2 shrink-0">
                    {isOnline ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded-lg">
                            <Wifi className="w-3 h-3" />
                        متصل
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 px-2 py-1 rounded-lg">
                            <WifiOff className="w-3 h-3" />
                            غير متصل
                        </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/60 px-2 py-1 rounded-lg">
                        <ShieldCheck className="w-3 h-3" />
                        توقيت محصّن
                    </span>
                </div>
            </div>

            {/* تحذير التلاعب بالساعة */}
            {isTampered && (
                <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-800/60 flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-200 font-bold">
                            {tamperInfo.message}
                        </p>
                        <button
                            type="button"
                            onClick={() => { forceSync(); }}
                            className="mt-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-300 underline underline-offset-2 hover:opacity-80"
                        >
                            إعادة مزامنة التوقيت الآن
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
