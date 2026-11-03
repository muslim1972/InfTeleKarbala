/**
 * HistoricalModeBanner.tsx — شريط التنبيه المستمر للوضع التاريخي (للقراءة فقط)
 * يظهر في أعلى الشاشة عندما يختار المستخدم أو المشرف استعراض شهر سابق
 * يوفر مؤشراً بصرياً حتمياً (Visual Affordance) وزر رجوع فوري بنقرة واحدة
 */
import { Lock, RotateCcw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useSnapshots } from '../../context/SnapshotContext';

export const HistoricalModeBanner = () => {
    const { isHistorical, historicalSnapshot, exitHistoricalView } = useSnapshots();

    if (!isHistorical || !historicalSnapshot) return null;

    const handleBack = () => {
        exitHistoricalView();
        toast.success('تمت العودة إلى النسخة الحالية المعتمدة', { icon: '↩️', duration: 2500 });
    };

    return (
        <aside
            aria-label="تنبيه الأرشيف التاريخي"
            className="w-full bg-gradient-to-r from-amber-500/20 via-amber-500/15 to-amber-500/20 border-b border-amber-500/30 text-amber-900 dark:text-amber-200 px-3 py-2 transition-all duration-300 animate-in fade-in slide-in-from-top-1 z-40 backdrop-blur-md shadow-sm"
        >
            <div className="max-w-4xl mx-auto flex items-center justify-between gap-2 text-xs font-tajawal">
                {/* معلومات الشهر المستعرض */}
                <div className="flex items-center gap-2 min-w-0">
                    <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-amber-500/25 text-amber-600 dark:text-amber-400 shrink-0">
                        <Lock className="w-3.5 h-3.5" />
                    </span>
                    <div className="truncate">
                        <span className="font-bold">أرشيف مغلق: </span>
                        <span className="font-black text-amber-700 dark:text-amber-300">
                            {historicalSnapshot.name}
                        </span>
                        <span className="hidden sm:inline text-[11px] opacity-80 mr-1.5">
                            (للاطلاع والتدقيق فقط — غير قابل للتعديل)
                        </span>
                    </div>
                </div>

                {/* زر الخروج السريع */}
                <button
                    onClick={handleBack}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs shadow-sm transition-all"
                    title="العودة إلى بيانات الشهر الحالي المعتمد"
                >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>العودة للحالي</span>
                </button>
            </div>
        </aside>
    );
};
