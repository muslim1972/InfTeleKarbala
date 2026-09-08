/**
 * SnapshotBrowser.tsx - متصفح النسخ الشهرية
 * يتيح لأي مستخدم البحث في النسخ المحفوظة واختيار نسخة لعرضها،
 * فتتغير قيم كل الحقول في التطبيق تبعاً للنسخة المختارة.
 * الحذف متاح للمطور فقط.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Search, History, Check, Trash2, Loader2, Database, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useSnapshots } from '../../context/SnapshotContext';
import {
    listMonthlySnapshots,
    deleteMonthlySnapshot,
    isDeveloper,
    type MonthlySnapshot
} from '../../utils/snapshots';

interface SnapshotBrowserProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SnapshotBrowser = ({ isOpen, onClose }: SnapshotBrowserProps) => {
    const { user } = useAuth();
    const { activeSnapshot, activate } = useSnapshots();
    const [snapshots, setSnapshots] = useState<MonthlySnapshot[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [activatingId, setActivatingId] = useState<string | null>(null);
    const [confirmingId, setConfirmingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const developer = isDeveloper(user as any);

    const loadSnapshots = useCallback(async () => {
        setLoading(true);
        try {
            const list = await listMonthlySnapshots();
            setSnapshots(list);
        } catch (err: any) {
            toast.error('تعذر جلب النسخ: ' + (err.message || 'خطأ غير معروف'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            loadSnapshots();
            setConfirmingId(null);
            setDeletingId(null);
        }
    }, [isOpen, loadSnapshots]);

    const filtered = useMemo(() => {
        const q = search.trim();
        if (!q) return snapshots;
        return snapshots.filter(s =>
            s.name.includes(q) || (s.created_by_name || '').includes(q)
        );
    }, [snapshots, search]);

    const handleActivate = async (snap: MonthlySnapshot) => {
        if (snap.is_active) return;
        if (confirmingId !== snap.id) {
            setConfirmingId(snap.id);
            setDeletingId(null);
            return;
        }
        setConfirmingId(null);
        setBusy(true);
        setActivatingId(snap.id);
        const toastId = toast.loading(`جاري عرض نسخة «${snap.name}»...`, { duration: 60000 });
        try {
            const res = await activate(snap.id);
            toast.success(`تم عرض نسخة «${res.name}» — تحديث ${res.restored} سجلاً`, { id: toastId, duration: 5000 });
        } catch (err: any) {
            toast.error('فشل التفعيل: ' + (err.message || 'خطأ غير معروف'), { id: toastId });
        } finally {
            toast.dismiss(toastId);
            setBusy(false);
            setActivatingId(null);
        }
    };

    const handleDelete = async (snap: MonthlySnapshot) => {
        if (deletingId !== snap.id) {
            setDeletingId(snap.id);
            setConfirmingId(null);
            return;
        }
        setDeletingId(null);
        setBusy(true);
        const toastId = toast.loading(`جاري حذف نسخة «${snap.name}»...`);
        try {
            await deleteMonthlySnapshot(snap.id);
            setSnapshots(prev => prev.filter(s => s.id !== snap.id));
            toast.success(`تم حذف نسخة «${snap.name}»`, { id: toastId });
        } catch (err: any) {
            toast.error('فشل الحذف: ' + (err.message || 'خطأ غير معروف'), { id: toastId });
        } finally {
            setBusy(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 pb-24 md:pb-28 overflow-y-auto bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-2xl max-h-[calc(100vh-9rem)] overflow-hidden flex flex-col rounded-3xl bg-zinc-950/80 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] ring-1 ring-white/5 backdrop-blur-xl relative">

                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-green/10 rounded-full blur-[100px] pointer-events-none"></div>

                {/* Header */}
                <div className="p-5 border-b border-white/5 flex justify-between items-center relative z-10 bg-black/20">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-brand-green/20 to-brand-green/5 border border-brand-green/20 shadow-inner">
                            <History className="w-6 h-6 text-brand-green drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold font-tajawal text-white">النسخ الشهرية</h2>
                            <p className="text-xs text-white/50 font-tajawal">
                                اختر نسخة لعرض بياناتها في كل التطبيق
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

                {/* شريط النسخة المعروضة + البحث */}
                <div className="p-4 border-b border-white/5 space-y-3 relative z-10">
                    {activeSnapshot && (
                        <div className="flex items-center gap-2 text-sm font-tajawal bg-brand-green/10 border border-brand-green/30 text-brand-green rounded-xl px-3 py-2">
                            <Database className="w-4 h-4 shrink-0" />
                            <span>
                                النسخة المعروضة حالياً: <span className="font-bold">{activeSnapshot.name}</span>
                                <span className="text-white/40 mr-2">({activeSnapshot.financial_count} سجلاً مالياً)</span>
                            </span>
                        </div>
                    )}
                    <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="ابحث بالاسم أو منشئ النسخة..."
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
                        <p className="text-center text-white/40 py-10 text-sm font-tajawal">لا توجد نسخ مطابقة</p>
                    ) : (
                        filtered.map(snap => {
                            const isActive = snap.is_active;
                            const confirming = confirmingId === snap.id;
                            const deleting = deletingId === snap.id;
                            return (
                                <div
                                    key={snap.id}
                                    className={`rounded-2xl border p-3.5 transition-all ${
                                        isActive
                                            ? 'bg-brand-green/10 border-brand-green/40 shadow-[0_0_15px_rgba(34,197,94,0.15)]'
                                            : 'bg-white/5 border-white/10 hover:border-white/20'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className={`font-bold font-tajawal text-sm truncate ${isActive ? 'text-brand-green' : 'text-white'}`}>
                                                    {snap.name}
                                                </h3>
                                                {isActive && (
                                                    <span className="text-[10px] bg-brand-green text-black font-bold px-2 py-0.5 rounded-full font-tajawal">
                                                        معروضة حالياً
                                                    </span>
                                                )}
                                            </div>
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
                                            {!isActive && (
                                                <button
                                                    onClick={() => handleActivate(snap)}
                                                    disabled={busy}
                                                    className={`flex items-center gap-1.5 text-xs font-bold font-tajawal px-3 py-1.5 rounded-xl transition-all disabled:opacity-50 ${
                                                        confirming
                                                            ? 'bg-amber-500 hover:bg-amber-400 text-black animate-pulse'
                                                            : 'bg-brand-green/20 text-brand-green border border-brand-green/40 hover:bg-brand-green/30'
                                                    }`}
                                                >
                                                    {activatingId === snap.id ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    ) : confirming ? (
                                                        <>
                                                            <AlertTriangle className="w-3.5 h-3.5" />
                                                            تأكيد التفعيل؟
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Check className="w-3.5 h-3.5" />
                                                            عرض
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                            {developer && !isActive && (
                                                <button
                                                    onClick={() => handleDelete(snap)}
                                                    disabled={busy}
                                                    className={`flex items-center justify-center w-8 h-8 rounded-xl transition-all disabled:opacity-50 ${
                                                        deleting
                                                            ? 'bg-red-500 text-white animate-pulse'
                                                            : 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
                                                    }`}
                                                    title={deleting ? 'انقر مرة أخرى للحذف النهائي' : 'حذف النسخة (للمطور)'}
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {confirming && (
                                        <p className="text-[11px] text-amber-400/80 font-tajawal mt-2">
                                            سيتم استبدال البيانات المعروضة في كل التطبيق ببيانات هذه النسخة (أرصدة الإجازات الحالية لا تتأثر). انقر «تأكيد التفعيل» للمتابعة.
                                        </p>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};
