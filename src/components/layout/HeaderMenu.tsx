/**
 * HeaderMenu.tsx — قائمة النقاط العمودية (⋮) في الهيدر
 * تنقل عناصر الهيدر المزدحم إليها كي "يتنفس" الشريط العلوي على الموبايل:
 *   1) المظهر (ليلي/نهاري) بمفتاح أنيق
 *   2) حجم الخط — كل المقاسات (80% → 138%)
 *   3) النسخة المعروضة — مع قائمة النسخ الشهرية المتوفرة في DB وتبديل فوري
 */
import { useEffect, useRef, useState } from 'react';
import {
    MoreVertical, Sun, Moon, Type, History, Check, Loader2, Palette, Database, Power
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useTheme } from '../../context/ThemeContext';
import {
    useAccessibility, FONT_SCALE_OPTIONS, type FontScale
} from '../../context/AccessibilityContext';
import { useSnapshots } from '../../context/SnapshotContext';
import { useAuth } from '../../context/AuthContext';
import { useGovernorate } from '../../context/GovernorateContext';
import { listMonthlySnapshots, type MonthlySnapshot } from '../../utils/snapshots';

export const HeaderMenu = () => {
    const { theme, toggleTheme } = useTheme();
    const { fontScale, setFontScale, currentOption } = useAccessibility();
    const { activeSnapshot, activate } = useSnapshots();
    const { user, logout } = useAuth();
    const { activeGovernorate } = useGovernorate();

    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    // قائمة النسخ (تُجلب عند أول فتح)
    const [snapshots, setSnapshots] = useState<MonthlySnapshot[] | null>(null);
    const [loadingList, setLoadingList] = useState(false);
    const [confirmingId, setConfirmingId] = useState<string | null>(null);
    const [activatingId, setActivatingId] = useState<string | null>(null);

    const light = theme === 'light';

    /* إغلاق القائمة عند النقر خارجها أو الضغط على Escape */
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent | TouchEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('touchstart', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('touchstart', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    /* جلب كسول لنسخ الأشهر المتوفرة في DB */
    useEffect(() => {
        if (!open || snapshots || loadingList) return;
        setLoadingList(true);
        listMonthlySnapshots(activeGovernorate || user?.governorate || 'karbala')
            .then(setSnapshots)
            .catch(() => setSnapshots([]))
            .finally(() => setLoadingList(false));
    }, [open, snapshots, loadingList, activeGovernorate, user?.governorate]);

    /* إعادة ضبط التأكيد عند الإغلاق */
    useEffect(() => {
        if (!open) setConfirmingId(null);
    }, [open]);

    const handlePickScale = (id: FontScale, label: string, percentage: string) => {
        setFontScale(id);
        toast.success(`حجم الخط: ${label} (${percentage})`, { id: 'font-scale-toast', duration: 1500 });
    };

    const handleActivate = async (snap: MonthlySnapshot) => {
        if (snap.is_active || activatingId) return;
        // تأكيد بنقرتين — كما في متصفح النسخ
        if (confirmingId !== snap.id) {
            setConfirmingId(snap.id);
            return;
        }
        setConfirmingId(null);
        setActivatingId(snap.id);
        const toastId = toast.loading(`جاري عرض نسخة «${snap.name}»...`, { duration: 60000 });
        try {
            const res = await activate(snap.id);
            toast.success(`تم عرض نسخة «${res.name}» — جاري تحديث البيانات...`, { id: toastId, duration: 2000 });
            setOpen(false);
            window.location.reload();
        } catch (err: any) {
            toast.error('فشل التفعيل: ' + (err.message || 'خطأ غير معروف'), { id: toastId });
            setActivatingId(null);
        }
    };

    return (
        <div className="relative" ref={rootRef}>
            {/* زر النقاط الثلاث */}
            <button
                onClick={() => setOpen((v) => !v)}
                aria-label="قائمة الخيارات"
                aria-expanded={open}
                className={`flex items-center justify-center w-9 h-9 rounded-full border transition-all duration-300 active:scale-90 ${
                    open
                        ? 'bg-brand-green/20 text-brand-green border-brand-green/50 shadow-[0_0_12px_rgba(34,197,94,0.3)]'
                        : light
                        ? 'bg-white/90 text-gray-700 border-gray-200 hover:bg-gray-100 shadow-sm'
                        : 'bg-white/10 text-white/90 border-white/20 hover:bg-white/20'
                }`}
            >
                <MoreVertical className={`w-[18px] h-[18px] transition-transform duration-300 ${open ? 'rotate-90' : ''}`} />
            </button>

            {/* اللوحة المنسدلة */}
            {open && (
                <div
                    className={`absolute left-0 top-full mt-2 z-[80] w-[290px] max-w-[calc(100vw-1.5rem)] max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-2xl border shadow-2xl backdrop-blur-xl origin-top-left animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200 ${
                        light
                            ? 'bg-white !border-gray-200/80 shadow-gray-400/30'
                            : '!bg-[#111a2e] !border-white/10 shadow-black/60'
                    }`}
                >
                    {/* ═══ 1) المظهر ═══ */}
                    <div className="p-3">
                        <div className={`flex items-center gap-1.5 mb-2 text-[10px] font-bold font-cairo ${
                            light ? 'text-gray-400' : 'text-white/40'
                        }`}>
                            <Palette className="w-3 h-3" />
                            <span>المظهر</span>
                        </div>
                        <button
                            onClick={toggleTheme}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all duration-300 active:scale-[0.98] ${
                                light
                                    ? 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                            }`}
                        >
                            <span className={`flex items-center gap-2.5 text-xs font-bold font-tajawal ${
                                light ? 'text-gray-800' : 'text-white/90'
                            }`}>
                                {light ? (
                                    <Sun className="w-4 h-4 text-amber-500" />
                                ) : (
                                    <Moon className="w-4 h-4 text-indigo-300" />
                                )}
                                {light ? 'الوضع النهاري' : 'الوضع الليلي'}
                            </span>
                            {/* مفتاح بنمط iOS */}
                            <span className={`relative w-10 h-[22px] rounded-full transition-colors duration-300 ${
                                light ? 'bg-amber-400' : 'bg-slate-600'
                            }`}>
                                <span className={`absolute top-[3px] right-[3px] w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-300 ${
                                    light ? '' : '-translate-x-[18px]'
                                }`} />
                            </span>
                        </button>
                    </div>

                    <div className={`border-t ${light ? 'border-gray-100' : 'border-white/5'}`} />

                    {/* ═══ 2) حجم الخط ═══ */}
                    <div className="p-3">
                        <div className={`flex items-center justify-between mb-2 text-[10px] font-bold font-cairo ${
                            light ? 'text-gray-400' : 'text-white/40'
                        }`}>
                            <span className="flex items-center gap-1.5">
                                <Type className="w-3 h-3" />
                                <span>حجم الخط</span>
                            </span>
                            <span className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] ${
                                fontScale !== 'normal'
                                    ? 'bg-brand-green/20 text-brand-green'
                                    : light ? 'bg-gray-100 text-gray-500' : 'bg-white/10 text-white/50'
                            }`}>
                                {currentOption.percentage}
                            </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                            {FONT_SCALE_OPTIONS.map((opt) => {
                                const active = fontScale === opt.id;
                                return (
                                    <button
                                        key={opt.id}
                                        onClick={() => handlePickScale(opt.id, opt.label, opt.percentage)}
                                        className={`relative h-8 rounded-lg border text-[11px] font-bold font-mono transition-all duration-200 active:scale-95 ${
                                            active
                                                ? 'bg-brand-green/20 text-brand-green border-brand-green/50 shadow-[0_0_10px_rgba(34,197,94,0.25)]'
                                                : light
                                                ? 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                                                : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
                                        }`}
                                        title={opt.label}
                                    >
                                        {opt.percentage}
                                        {active && (
                                            <Check className="absolute -top-1 -left-1 w-3 h-3 text-brand-green bg-white dark:bg-[#111a2e] rounded-full" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className={`border-t ${light ? 'border-gray-100' : 'border-white/5'}`} />

                    {/* ═══ 3) النسخة المعروضة + النسخ المتوفرة ═══ */}
                    <div className="p-3">
                        <div className={`flex items-center gap-1.5 mb-2 text-[10px] font-bold font-cairo ${
                            light ? 'text-gray-400' : 'text-white/40'
                        }`}>
                            <Database className="w-3 h-3" />
                            <span>النسخة المعروضة — نسخ الأشهر</span>
                        </div>

                        {/* بطاقة النسخة الحالية */}
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border mb-2 ${
                            light
                                ? 'bg-brand-green/10 border-brand-green/30'
                                : 'bg-brand-green/15 border-brand-green/40'
                        }`}>
                            <History className="w-4 h-4 text-brand-green shrink-0" />
                            <span className="text-xs font-bold font-tajawal text-brand-green truncate flex-1">
                                {activeSnapshot ? activeSnapshot.name : 'لا توجد نسخة نشطة'}
                            </span>
                            <span className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-brand-green text-white text-[9px] font-bold">
                                <Check className="w-2.5 h-2.5" />
                                معروضة
                            </span>
                        </div>

                        {/* قائمة النسخ المتوفرة في DB */}
                        <div className={`rounded-xl border ${light ? 'border-gray-200 bg-gray-50/60' : 'border-white/10 bg-black/20'}`}>
                            {loadingList ? (
                                <div className="flex items-center justify-center gap-2 py-4 text-[11px] text-gray-400">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    جاري جلب النسخ...
                                </div>
                            ) : !snapshots || snapshots.length === 0 ? (
                                <div className="py-4 text-center text-[11px] text-gray-400">لا توجد نسخ محفوظة</div>
                            ) : (
                                <div>
                                    {snapshots.map((snap) => {
                                        const isActive = snap.is_active;
                                        const confirming = confirmingId === snap.id;
                                        const activating = activatingId === snap.id;
                                        if (isActive) return null; // النسخة المعروضة ظاهرة في البطاقة أعلاه
                                        return (
                                            <button
                                                key={snap.id}
                                                onClick={() => handleActivate(snap)}
                                                disabled={activatingId !== null}
                                                className={`w-full flex items-center justify-between gap-2 px-3 py-2 border-b last:border-b-0 text-right transition-colors ${
                                                    confirming
                                                        ? 'bg-amber-500/20'
                                                        : light
                                                        ? 'hover:bg-gray-100 border-gray-100'
                                                        : 'hover:bg-white/5 border-white/5'
                                                } disabled:opacity-60`}
                                            >
                                                <span className={`text-[11px] font-bold font-tajawal truncate ${
                                                    confirming ? 'text-amber-500' : light ? 'text-gray-700' : 'text-white/80'
                                                }`}>
                                                    {activating ? 'جاري التفعيل...' : confirming ? 'اضغط مرة أخرى للتأكيد' : snap.name}
                                                </span>
                                                {activating ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-green shrink-0" />
                                                ) : confirming ? (
                                                    <Check className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                                ) : (
                                                    <span className={`text-[9px] shrink-0 px-1.5 py-0.5 rounded-md ${
                                                        light ? 'bg-gray-200/70 text-gray-500' : 'bg-white/10 text-white/40'
                                                    }`}>
                                                        عرض
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        <p className={`mt-1.5 text-[9px] leading-relaxed ${light ? 'text-gray-400' : 'text-white/30'}`}>
                            اختيار نسخة يعرض بيانات ذلك الشهر في كامل التطبيق
                        </p>
                    </div>

                    <div className={`border-t ${light ? 'border-gray-100' : 'border-white/5'}`} />

                    {/* ═══ 4) تسجيل الخروج ═══ */}
                    <div className="p-3">
                        <button
                            onClick={() => {
                                setOpen(false);
                                if (window.confirm("هل أنت متأكد من تسجيل الخروج؟")) {
                                    logout();
                                }
                            }}
                            className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold font-tajawal transition-all duration-300 active:scale-[0.98] ${
                                light
                                    ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                                    : 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'
                            }`}
                        >
                            <Power className="w-4 h-4" />
                            <span>تسجيل الخروج</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
