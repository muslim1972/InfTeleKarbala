/**
 * SnapshotBrowser.tsx - متصفح النسخ الشهرية
 * يتيح لأي مستخدم البحث في النسخ المحفوظة واختيار نسخة لاستعراضها (للاطلاع فقط)،
 * فتتغير قيم كل الحقول في التطبيق تبعاً للنسخة المختارة دون أي مساس بقاعدة البيانات الحية.
 * الحذف متاح للمطور فقط.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Search, History, Check, Trash2, Loader2, Database, AlertTriangle, FileSpreadsheet, Lock, RotateCcw, Eye, Edit2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useSnapshots } from '../../context/SnapshotContext';
import { governorateName, GOVERNORATES } from '../../constants/governorates';
import {
    listMonthlySnapshots,
    deleteMonthlySnapshot,
    renameMonthlySnapshot,
    isDeveloper,
    type MonthlySnapshot
} from '../../utils/snapshots';
import { useGovernorate } from '../../context/GovernorateContext';

interface SnapshotBrowserProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SnapshotBrowser = ({ isOpen, onClose }: SnapshotBrowserProps) => {
    const { user } = useAuth();
    const {
        activeSnapshot,
        historicalSnapshot,
        isHistorical,
        viewSnapshot,
        exitHistoricalView,
        refresh
    } = useSnapshots();

    const [snapshots, setSnapshots] = useState<MonthlySnapshot[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState<string>('');
    const [busy, setBusy] = useState(false);

    const developer = isDeveloper(user as any);
    const { activeGovernorate } = useGovernorate();
    const sessionGov = activeGovernorate;
    const currentGov = sessionGov || user?.governorate || 'karbala';
    const [selectedGov, setSelectedGov] = useState<string>(currentGov);

    const loadSnapshots = useCallback(async (gov: string) => {
        setLoading(true);
        try {
            const list = await listMonthlySnapshots(gov);
            setSnapshots(list);
        } catch (err: any) {
            toast.error('تعذر جلب النسخ: ' + (err.message || 'خطأ غير معروف'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            const gov = activeGovernorate || user?.governorate || 'karbala';
            setSelectedGov(gov);
            loadSnapshots(gov);
            refresh(gov);
            setDeletingId(null);
        }
    }, [isOpen, activeGovernorate, user?.governorate, loadSnapshots, refresh]);

    const handleGovChange = (newGov: string) => {
        setSelectedGov(newGov);
        loadSnapshots(newGov);
        refresh(newGov);
    };

    const filtered = useMemo(() => {
        const q = search.trim();
        if (!q) return snapshots;
        return snapshots.filter(s =>
            s.name.includes(q) || (s.created_by_name || '').includes(q)
        );
    }, [snapshots, search]);

    // التبديل الآمن للاستعراض التاريخي (للقراءة فقط دون reload ودون مساس بالبيانات الحية)
    const handleSelectSnapshot = (snap: MonthlySnapshot) => {
        if (snap.id === activeSnapshot?.id) {
            if (isHistorical) {
                exitHistoricalView();
                toast.success(`تمت العودة إلى الشهر الحالي «${activeSnapshot.name}» (النسخة الحية)`, {
                    icon: '↩️',
                    duration: 2500
                });
            } else {
                toast(`أنت بالفعل في الشهر الحالي «${activeSnapshot.name}»`, { icon: 'ℹ️' });
            }
            onClose();
            return;
        }

        // اختيار نسخة تاريخية للاستعراض فقط
        viewSnapshot(snap);
        toast.success(`تم الانتقال لعرض أرشيف «${snap.name}» (للاطلاع فقط)`, {
            icon: '🔒',
            duration: 3000
        });
        onClose();
    };

    const handleStartRename = (snap: MonthlySnapshot) => {
        setEditingId(snap.id);
        setEditingName(snap.name);
    };

    const handleSaveRename = async (snapId: string) => {
        const trimmed = editingName.trim();
        if (!trimmed || trimmed.length < 2) {
            toast.error('يرجى إدخال اسم صحيح للنسخة');
            return;
        }
        setBusy(true);
        const toastId = toast.loading('جاري تعديل اسم النسخة...');
        try {
            await renameMonthlySnapshot(snapId, trimmed);
            setSnapshots(prev => prev.map(s => s.id === snapId ? { ...s, name: trimmed } : s));
            setEditingId(null);
            toast.success(`تم تعديل اسم النسخة إلى «${trimmed}»`, { id: toastId });
            refresh(selectedGov);
        } catch (err: any) {
            toast.error('فشل تعديل الاسم: ' + (err.message || 'خطأ غير معروف'), { id: toastId });
        } finally {
            setBusy(false);
        }
    };

    const handleDelete = async (snap: MonthlySnapshot) => {
        if (deletingId !== snap.id) {
            setDeletingId(snap.id);
            return;
        }
        setDeletingId(null);
        setBusy(true);
        const toastId = toast.loading(snap.is_active ? `جاري التراجع وحذف النسخة الحية «${snap.name}»...` : `جاري حذف نسخة «${snap.name}»...`);
        try {
            await deleteMonthlySnapshot(snap.id);
            setSnapshots(prev => prev.filter(s => s.id !== snap.id));
            toast.success(snap.is_active ? `تم التراجع وحذف النسخة واعتماد النسخة السابقة` : `تم حذف نسخة «${snap.name}»`, { id: toastId });
            if (historicalSnapshot?.id === snap.id) {
                exitHistoricalView();
            }
            refresh(selectedGov);
            loadSnapshots(selectedGov);
        } catch (err: any) {
            toast.error('فشل الحذف: ' + (err.message || 'خطأ غير معروف'), { id: toastId });
        } finally {
            setBusy(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 pb-24 md:pb-28 overflow-y-auto bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-2xl max-h-[calc(100vh-9rem)] overflow-hidden flex flex-col rounded-3xl bg-zinc-950/90 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.6)] ring-1 ring-white/5 backdrop-blur-xl relative">

                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-green/10 rounded-full blur-[100px] pointer-events-none"></div>

                {/* Header */}
                <div className="p-5 border-b border-white/5 flex justify-between items-center relative z-10 bg-black/20">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-brand-green/20 to-brand-green/5 border border-brand-green/20 shadow-inner">
                            <History className="w-6 h-6 text-brand-green drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-bold font-tajawal text-white">النسخ والأرشيفات الشهرية</h2>
                                <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-green/20 text-brand-green border border-brand-green/30 font-bold font-tajawal">
                                    {governorateName(selectedGov)}
                                </span>
                            </div>
                            <p className="text-xs text-white/50 font-tajawal">
                                استعراض محفوظات الأشهر السابقة للاطلاع والتدقيق بأمان دون التأثير على النظام الحي
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                        title="إغلاق"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* شريط حالة الاستعراض الحالي + المحافظة للمطور + البحث */}
                <div className="p-4 border-b border-white/5 space-y-3 relative z-10">
                    {developer && (
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-tajawal">
                            <span className="text-white/40 shrink-0 text-[11px]">المحافظة:</span>
                            {GOVERNORATES.filter(g => ['karbala', 'babil', 'najaf', 'baghdad_karkh', 'basra'].includes(g.id) || g.id === selectedGov).map(g => (
                                <button
                                    key={g.id}
                                    type="button"
                                    onClick={() => handleGovChange(g.id)}
                                    className={`px-2.5 py-1 rounded-lg transition-colors shrink-0 text-xs font-medium ${
                                        selectedGov === g.id
                                            ? 'bg-brand-green text-black font-bold shadow'
                                            : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                                    }`}
                                >
                                    {g.name}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* تنبيه إذا كان المستخدم في الوضع التاريخي مع زر العودة */}
                    {isHistorical && historicalSnapshot ? (
                        <div className="flex items-center justify-between gap-2 text-xs font-tajawal bg-amber-500/15 border border-amber-500/30 text-amber-300 rounded-xl px-3 py-2.5 shadow-sm">
                            <div className="flex items-center gap-2 min-w-0">
                                <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                                <span className="truncate">
                                    أنت تستعرض حالياً: <span className="font-bold text-amber-200">«{historicalSnapshot.name}»</span> (للاطلاع فقط)
                                </span>
                            </div>
                            <button
                                onClick={() => {
                                    exitHistoricalView();
                                    toast.success('تمت العودة إلى الشهر الحالي', { icon: '↩️' });
                                    onClose();
                                }}
                                className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-all active:scale-95 shadow"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>العودة للحالي</span>
                            </button>
                        </div>
                    ) : activeSnapshot && (activeSnapshot.governorate === selectedGov || (!activeSnapshot.governorate && selectedGov === 'karbala')) ? (
                        <div className="flex items-center gap-2 text-xs font-tajawal bg-brand-green/10 border border-brand-green/30 text-brand-green rounded-xl px-3 py-2">
                            <Database className="w-4 h-4 shrink-0" />
                            <span>
                                النسخة الحية المعتمدة ({governorateName(selectedGov)}): <span className="font-bold">{activeSnapshot.name}</span>
                                <span className="text-white/40 mr-2">({activeSnapshot.financial_count} سجلاً مالياً • {activeSnapshot.profile_count} موظفاً)</span>
                            </span>
                        </div>
                    ) : null}

                    <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder={`ابحث في نسخ ${governorateName(selectedGov)} بالاسم أو المنشئ...`}
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pr-10 pl-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-brand-green/50 font-tajawal"
                        />
                    </div>
                </div>

                {/* القائمة */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2.5 relative z-10">
                    {loading ? (
                        <div className="flex items-center justify-center py-10 text-white/50">
                            <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center text-white/40 py-10 space-y-2 font-tajawal">
                            <p className="text-sm font-bold text-white/60">
                                {search.trim() ? 'لا توجد نسخ مطابقة للبحث' : `لا توجد نسخ شهرية محفوظة لـ ${governorateName(selectedGov)}`}
                            </p>
                            {!search.trim() && (
                                <p className="text-xs text-white/30">
                                    يتم حفظ نسخة شهرية تلقائياً عند رفع ملف رواتب المحافظة عبر المحدث العام
                                </p>
                            )}
                        </div>
                    ) : (
                        filtered.map(snap => {
                            const isLiveActive = snap.is_active;
                            const isBeingViewed = isHistorical && historicalSnapshot?.id === snap.id;
                            const isLiveBeingViewed = !isHistorical && isLiveActive;
                            const deleting = deletingId === snap.id;

                            return (
                                <div
                                    key={snap.id}
                                    className={`rounded-2xl border p-3.5 transition-all ${
                                        isBeingViewed
                                            ? 'bg-amber-500/15 border-amber-500/50 shadow-[0_0_18px_rgba(245,158,11,0.2)]'
                                            : isLiveBeingViewed
                                            ? 'bg-brand-green/10 border-brand-green/40 shadow-[0_0_15px_rgba(34,197,94,0.15)]'
                                            : 'bg-white/5 border-white/10 hover:border-white/20'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            {editingId === snap.id ? (
                                                <div className="flex items-center gap-2 my-1">
                                                    <input
                                                        type="text"
                                                        value={editingName}
                                                        onChange={e => setEditingName(e.target.value)}
                                                        className="flex-1 bg-black/60 border border-brand-green/60 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-green font-tajawal font-bold"
                                                        placeholder="اسم النسخة الجديد..."
                                                        autoFocus
                                                    />
                                                    <button
                                                        onClick={() => handleSaveRename(snap.id)}
                                                        disabled={busy}
                                                        className="px-3 py-1.5 rounded-xl bg-brand-green hover:bg-brand-green/90 text-black text-xs font-bold font-tajawal transition-colors"
                                                    >
                                                        حفظ
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingId(null)}
                                                        className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 text-xs font-tajawal transition-colors"
                                                    >
                                                        إلغاء
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className={`font-bold font-tajawal text-sm truncate ${
                                                        isBeingViewed
                                                            ? 'text-amber-300'
                                                            : isLiveActive
                                                            ? 'text-brand-green'
                                                            : 'text-white'
                                                    }`}>
                                                        {snap.name}
                                                    </h3>
                                                    {isLiveActive && (
                                                        <span className="text-[10px] bg-brand-green text-black font-bold px-2 py-0.5 rounded-full font-tajawal">
                                                            النسخة الحية
                                                        </span>
                                                    )}
                                                    {isBeingViewed && (
                                                        <span className="text-[10px] bg-amber-500 text-black font-bold px-2 py-0.5 rounded-full font-tajawal flex items-center gap-1">
                                                            <Lock className="w-2.5 h-2.5" />
                                                            مستعرضة الآن (للاطلاع)
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            <p className="text-[11px] text-white/40 font-tajawal mt-1 flex items-center gap-2 flex-wrap">
                                                <span className="flex items-center gap-1">
                                                    <FileSpreadsheet className="w-3 h-3" />
                                                    {snap.financial_count} سجلاً مالياً
                                                </span>
                                                <span>• {snap.profile_count} موظفاً</span>
                                                <span>• {new Date(snap.created_at).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                                {snap.created_by_name && <span>• بواسطة {snap.created_by_name}</span>}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {isBeingViewed ? (
                                                <button
                                                    onClick={() => handleSelectSnapshot(snap)}
                                                    className="flex items-center gap-1.5 text-xs font-bold font-tajawal px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 cursor-default"
                                                    title="هذه النسخة معروضة حالياً على شاشتك"
                                                >
                                                    <Check className="w-3.5 h-3.5" />
                                                    معروضة
                                                </button>
                                            ) : isLiveBeingViewed ? (
                                                <button
                                                    onClick={() => handleSelectSnapshot(snap)}
                                                    className="flex items-center gap-1.5 text-xs font-bold font-tajawal px-3 py-1.5 rounded-xl bg-brand-green/20 text-brand-green border border-brand-green/40 cursor-default"
                                                    title="أنت في النسخة الحية الحالية"
                                                >
                                                    <Check className="w-3.5 h-3.5" />
                                                    الحالية
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleSelectSnapshot(snap)}
                                                    disabled={busy}
                                                    className={`flex items-center gap-1.5 text-xs font-bold font-tajawal px-3 py-1.5 rounded-xl transition-all disabled:opacity-50 active:scale-95 ${
                                                        isLiveActive
                                                            ? 'bg-brand-green hover:bg-brand-green/90 text-black shadow-sm'
                                                            : 'bg-white/10 hover:bg-white/20 text-white border border-white/15'
                                                    }`}
                                                >
                                                    {isLiveActive ? (
                                                        <>
                                                            <RotateCcw className="w-3.5 h-3.5" />
                                                            العودة للحالي
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Eye className="w-3.5 h-3.5" />
                                                            استعراض
                                                        </>
                                                    )}
                                                </button>
                                            )}

                                            {developer && (
                                                <>
                                                    <button
                                                        onClick={() => handleStartRename(snap)}
                                                        disabled={busy}
                                                        className="flex items-center justify-center w-8 h-8 rounded-xl transition-all disabled:opacity-50 bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20"
                                                        title="تعديل اسم النسخة (تصحيح الشهر)"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>

                                                    <button
                                                        onClick={() => handleDelete(snap)}
                                                        disabled={busy}
                                                        className={`flex items-center justify-center w-8 h-8 rounded-xl transition-all disabled:opacity-50 ${
                                                            deleting
                                                                ? 'bg-red-500 text-white animate-pulse'
                                                                : 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
                                                        }`}
                                                        title={
                                                            deleting
                                                                ? (isLiveActive ? 'تأكيد التراجع وحذف النسخة الحية؟' : 'انقر مرة أخرى لتأكيد الحذف')
                                                                : (isLiveActive ? 'تراجع وحذف هذه النسخة الحية' : 'حذف النسخة (للمطور)')
                                                        }
                                                    >
                                                        {deleting ? <AlertTriangle className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};
