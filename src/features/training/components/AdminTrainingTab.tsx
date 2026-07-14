import { useState, useRef, useEffect, useCallback } from 'react';
import {
    FileSpreadsheet, Upload, Save, X, Loader2,
    ToggleLeft, ToggleRight, Clock, Trophy, Trash2,
    ChevronDown, CheckCircle2, GraduationCap, Shield,
    CheckCircle, XCircle, Search, UserPlus, UserMinus
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useTrainingData } from '../hooks/useTrainingData';
import { toast } from 'react-hot-toast';
import type { TrainingResult, TrainingStudent } from '../types';
import { calculateGrade, EXAM_GRADE_LABELS } from '../types';
import { supabase } from '../../../lib/supabase';
import { TrainingStudentsModal } from './TrainingStudentsModal';
interface AdminTrainingTabProps {
    isAdminView?: boolean;
}

interface SupervisorProfile {
    id: string;
    full_name: string;
    job_number: string | null;
}

/**
 * واجهة المشرف العام لإدارة التدريب الصيفي
 * قسم الطلبة + حالة الاختبار + رفع Excel + النتائج
 */
export const AdminTrainingTab = ({ isAdminView = false }: AdminTrainingTabProps) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const { user } = useAuth();
    const {
        settings, settingsLoading, updateSettings,
        uploadFile, deleteFile, checkFileExists,
        fetchResults, fetchStudents,
    } = useTrainingData();

    // ── Students Modal ──
    const [showStudentsModal, setShowStudentsModal] = useState(false);

    // ── Supervisor Search (Admin View) ──
    const [showSupervisorModal, setShowSupervisorModal] = useState(false);
    const [supervisorSearch, setSupervisorSearch] = useState('');
    const [supervisorSearchResults, setSupervisorSearchResults] = useState<SupervisorProfile[]>([]);
    const [currentSupervisors, setCurrentSupervisors] = useState<SupervisorProfile[]>([]);
    const [supervisorSearching, setSearching] = useState(false);
    const [supervisorsLoading, setSupervisorsLoading] = useState(false);
    const [togglingSupId, setTogglingSupId] = useState<string | null>(null);

    // ── Sections ──
    const [openSection, setOpenSection] = useState<'exams' | 'results' | null>(null);

    // ── Exam State (A & B) ──
    const [examFileA, setExamFileA] = useState<File | null>(null);
    const [examFileB, setExamFileB] = useState<File | null>(null);
    const [examUploading, setExamUploading] = useState(false);
    const [examExistingFiles, setExamExistingFiles] = useState<{ a: boolean; b: boolean }>({ a: false, b: false });
    const [examChecking, setExamChecking] = useState(false);
    const [examDeleting, setExamDeleting] = useState(false);
    const examFileRefA = useRef<HTMLInputElement>(null);
    const examFileRefB = useRef<HTMLInputElement>(null);

    // ── Settings State ──
    const [toggling, setToggling] = useState(false);
    const [durationInput, setDurationInput] = useState('');

    // ── Results State ──
    const [results, setResults] = useState<TrainingResult[]>([]);
    const [students, setStudents] = useState<TrainingStudent[]>([]);
    const [resultsLoading, setResultsLoading] = useState(false);
    const [selectedResult, setSelectedResult] = useState<TrainingResult | null>(null);

    useEffect(() => {
        if (settings) {
            setDurationInput(String(settings.exam_duration_minutes));
        }
    }, [settings]);

    const toggleSection = (section: 'exams' | 'results') => {
        setOpenSection(prev => prev === section ? null : section);
    };

    // ── Fixed subject key for summer training ──
    const TRAINING_SUBJECT = 'summer_training';

    // ── فحص الملفين الموجودين عند فتح قسم الاختبارات ──
    useEffect(() => {
        if (openSection !== 'exams') return;
        let cancelled = false;
        (async () => {
            setExamChecking(true);
            const [existsA, existsB] = await Promise.all([
                checkFileExists('exams', `${TRAINING_SUBJECT}_A`, 'xlsx'),
                checkFileExists('exams', `${TRAINING_SUBJECT}_B`, 'xlsx'),
            ]);
            if (!cancelled) {
                setExamExistingFiles({ a: existsA, b: existsB });
                setExamChecking(false);
            }
        })();
        return () => { cancelled = true; };
    }, [openSection, checkFileExists]);

    // ── مقارنة محتوى ملفين للتأكد من عدم التطابق ──
    const areFilesIdentical = async (fileA: File, fileB: File): Promise<boolean> => {
        if (fileA.size !== fileB.size) return false;
        const [bufA, bufB] = await Promise.all([fileA.arrayBuffer(), fileB.arrayBuffer()]);
        const viewA = new Uint8Array(bufA);
        const viewB = new Uint8Array(bufB);
        return viewA.every((val, i) => val === viewB[i]);
    };

    // ── Exam Handlers (A & B) ──
    const handleExamSave = async () => {
        if (!examFileA || !examFileB) {
            toast.error('يجب رفع ملفي الاختبار A و B معاً');
            return;
        }
        setExamUploading(true);
        const identical = await areFilesIdentical(examFileA, examFileB);
        if (identical) {
            setExamUploading(false);
            toast.error('ملفا الاختبار A و B متطابقان! يجب أن يكونا مختلفين لتمييز الطلبة المتجاورين.');
            return;
        }
        const resultA = await uploadFile('exams', `${TRAINING_SUBJECT}_A`, examFileA, 'xlsx');
        if (!resultA.success) {
            setExamUploading(false);
            toast.error(`فشل رفع اختبار A: ${resultA.error || 'خطأ غير معروف'}`);
            return;
        }
        const resultB = await uploadFile('exams', `${TRAINING_SUBJECT}_B`, examFileB, 'xlsx');
        setExamUploading(false);
        if (!resultB.success) {
            toast.error(`تم رفع A بنجاح لكن فشل رفع اختبار B: ${resultB.error || 'خطأ غير معروف'}`);
            return;
        }
        toast.success('تم رفع اختباري A و B بنجاح');
        setExamFileA(null);
        setExamFileB(null);
        setExamExistingFiles({ a: true, b: true });
        if (examFileRefA.current) examFileRefA.current.value = '';
        if (examFileRefB.current) examFileRefB.current.value = '';
    };

    const handleExamDeleteExisting = async () => {
        setExamDeleting(true);
        const [successA, successB] = await Promise.all([
            deleteFile('exams', `${TRAINING_SUBJECT}_A`, 'xlsx'),
            deleteFile('exams', `${TRAINING_SUBJECT}_B`, 'xlsx'),
        ]);
        setExamDeleting(false);
        if (successA || successB) {
            toast.success('تم حذف ملفات الاختبار');
            setExamExistingFiles({ a: false, b: false });
        } else {
            toast.error('فشل حذف الملفات');
        }
    };

    // ── Toggle Exam Active ──
    const handleToggleExam = async () => {
        if (!settings) return;
        setToggling(true);
        const success = await updateSettings({
            exam_active: !settings.exam_active,
            updated_by: user?.id || null,
        });
        setToggling(false);
        if (success) {
            toast.success(settings.exam_active ? 'تم إيقاف الاختبار' : 'تم تفعيل الاختبار');
        }
    };

    // ── Update Duration ──
    const handleSaveDuration = async () => {
        const val = parseInt(durationInput);
        if (isNaN(val) || val < 1 || val > 120) {
            toast.error('يرجى إدخال مدة صحيحة (1 - 120 دقيقة)');
            return;
        }
        const success = await updateSettings({ exam_duration_minutes: val });
        if (success) toast.success('تم تحديث مدة الاختبار');
    };

    // ── Load Results ──
    const loadResults = useCallback(async () => {
        setResultsLoading(true);
        try {
            const [resultsData, studentsData] = await Promise.all([
                fetchResults(),
                fetchStudents(),
            ]);
            setResults(resultsData);
            setStudents(studentsData);
        } catch (err) {
            console.error('Failed to load results:', err);
        }
        setResultsLoading(false);
    }, [fetchResults, fetchStudents]);

    useEffect(() => {
        if (openSection === 'results') loadResults();
    }, [openSection, loadResults]);

    // ── Delete Result ──
    const handleDeleteResult = async (id: string) => {
        if (!confirm('هل تريد حذف هذه النتيجة؟')) return;
        try {
            const { error } = await supabase.from('summer_training_results').delete().eq('id', id);
            if (error) throw error;
            setResults(prev => prev.filter(r => r.id !== id));
            toast.success('تم حذف النتيجة');
        } catch {
            toast.error('فشل حذف النتيجة');
        }
    };

    // ── Supervisor management (Admin View) ──
    const loadCurrentSupervisors = useCallback(async () => {
        setSupervisorsLoading(true);
        try {
            const { data, error } = await supabase.rpc('get_training_supervisors');
            if (error) throw error;
            setCurrentSupervisors(data || []);
        } catch (err) {
            console.error('فشل جلب المشرفين:', err);
        }
        setSupervisorsLoading(false);
    }, []);

    const handleSearchSupervisors = useCallback(async (query: string) => {
        if (!query.trim() || query.trim().length < 2) {
            setSupervisorSearchResults([]);
            return;
        }
        setSearching(true);
        try {
            const term = query.trim();
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, job_number')
                .or(`full_name.ilike.${term}%,job_number.ilike.${term}%`)
                .limit(20);
            if (error) throw error;
            setSupervisorSearchResults(data || []);
        } catch (err) {
            console.error('فشل البحث:', err);
        }
        setSearching(false);
    }, []);

    const handleToggleSupervisor = async (profileId: string, shouldBeSuper: boolean) => {
        setTogglingSupId(profileId);
        try {
            const { error } = await supabase.rpc('set_training_supervisor', {
                target_user_id: profileId,
                make_supervisor: shouldBeSuper,
            });
            if (error) throw error;
            toast.success(shouldBeSuper ? 'تمت إضافة المشرف' : 'تمت إزالة المشرف');
            await loadCurrentSupervisors();
            // Re-search to update results badges
            if (supervisorSearch.trim().length >= 2) {
                await handleSearchSupervisors(supervisorSearch);
            }
        } catch (err) {
            console.error('فشل تعيين المشرف:', err);
            toast.error('فشل تحديث صلاحية الإشراف');
        }
        setTogglingSupId(null);
    };

    useEffect(() => {
        if (showSupervisorModal) loadCurrentSupervisors();
    }, [showSupervisorModal, loadCurrentSupervisors]);

    // Debounced search
    useEffect(() => {
        if (!showSupervisorModal) return;
        const timer = window.setTimeout(() => {
            handleSearchSupervisors(supervisorSearch);
        }, 300);
        return () => window.clearTimeout(timer);
    }, [supervisorSearch, showSupervisorModal, handleSearchSupervisors]);

    // Section header button
    const SectionHeader = ({ title, icon: Icon, isOpen, onClick, color }: {
        title: string;
        icon: any;
        isOpen: boolean;
        onClick: () => void;
        color: string;
    }) => (
        <button
            onClick={onClick}
            className={cn(
                "w-full flex items-center justify-between p-4 rounded-xl border transition-all duration-300",
                isOpen
                    ? cn("shadow-md", isDark ? `bg-${color}-500/10 border-${color}-500/30` : `bg-${color}-50 border-${color}-200`)
                    : isDark ? "bg-white/5 border-white/10 hover:bg-white/10" : "bg-white border-slate-200 hover:bg-slate-50"
            )}
        >
            <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", `bg-${color}-500/20 text-${color}-500`)}>
                    <Icon className="w-5 h-5" />
                </div>
                <span className={cn("font-bold text-sm", isDark ? "text-white" : "text-slate-800")}>{title}</span>
            </div>
            <ChevronDown className={cn("w-5 h-5 transition-transform duration-300", isOpen ? "rotate-180" : "", isDark ? "text-white/50" : "text-slate-400")} />
        </button>
    );
    return (
        <div className="max-w-4xl mx-auto px-4 pb-20 mt-2 space-y-4 animate-in fade-in slide-in-from-right-5 duration-300">
            {isAdminView && (
                <div className={cn(
                    "rounded-2xl p-4 border flex flex-col sm:flex-row items-center justify-between gap-4 transition-all duration-300",
                    isDark
                        ? "bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-950 border-white/10"
                        : "bg-white border-slate-200 shadow-xl shadow-slate-100"
                )}>
                    <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-xl bg-emerald-500/10 text-emerald-500")}>
                            <Shield className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className={cn("text-sm font-bold", isDark ? "text-white" : "text-slate-800")}>تحديد المشرفين على التدريب الصيفي</h3>
                            <p className={cn("text-xs", isDark ? "text-white/50" : "text-slate-500")}>تحديد الموظفين كمشرفين على التدريب الصيفي</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowSupervisorModal(true)}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all active:scale-95 whitespace-nowrap"
                    >
                        تحديد المشرفين على التدريب الصيفي
                    </button>
                </div>
            )}

            {/* زر تحديد أسماء الطلبة */}
            <div className={cn(
                "rounded-2xl p-4 border flex flex-col sm:flex-row items-center justify-between gap-4 transition-all duration-300",
                isDark
                    ? "bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-950 border-white/10"
                    : "bg-white border-slate-200 shadow-xl shadow-slate-100"
            )}>
                <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-xl bg-emerald-500/10 text-emerald-500")}>
                        <GraduationCap className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className={cn("text-sm font-bold", isDark ? "text-white" : "text-slate-800")}>تحديد الطلبة المشاركين</h3>
                        <p className={cn("text-xs", isDark ? "text-white/50" : "text-slate-500")}>إضافة وإدارة الطلبة المتدربين في التدريب الصيفي</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowStudentsModal(true)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all active:scale-95 whitespace-nowrap"
                >
                    تحديد الطلبة المشاركين
                </button>
            </div>

            {/* ── Supervisor Search Modal (Admin View) ── */}
            {showSupervisorModal && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSupervisorModal(false)} />
                    <div className={cn(
                        "relative w-full max-w-xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200",
                        isDark ? 'bg-zinc-900 text-white border border-white/10' : 'bg-white text-slate-900 border border-slate-200'
                    )}>
                        {/* Header */}
                        <div className={cn("p-4 border-b flex items-center justify-between", isDark ? "border-white/10" : "border-slate-100")}>
                            <div>
                                <h2 className="text-lg font-bold">تحديد المشرفين على التدريب الصيفي</h2>
                                <p className={cn("text-xs mt-1", isDark ? "text-white/60" : "text-slate-500")}>ابحث عن الموظف بالاسم أو رقم الوظيفة</p>
                            </div>
                            <button onClick={() => setShowSupervisorModal(false)} className="p-2 rounded-full hover:bg-red-500/10 text-red-400 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Search */}
                        <div className={cn("p-4 border-b", isDark ? "border-white/10" : "border-slate-100")}>
                            <div className="relative">
                                <Search className={cn("absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4", isDark ? "text-white/40" : "text-slate-400")} />
                                <input
                                    type="text"
                                    value={supervisorSearch}
                                    onChange={e => setSupervisorSearch(e.target.value)}
                                    placeholder="ابحث بالاسم أو رقم الوظيفة..."
                                    className={cn(
                                        "w-full pr-10 pl-4 py-2.5 rounded-xl border text-sm font-bold transition-all outline-none",
                                        isDark
                                            ? "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-emerald-500/50"
                                            : "bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-emerald-500"
                                    )}
                                    dir="rtl"
                                    autoFocus
                                />
                                {supervisorSearching && <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-emerald-500" />}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {/* Search Results */}
                            {supervisorSearch.trim().length >= 2 && (
                                <div className={cn("p-4 border-b", isDark ? "border-white/10" : "border-slate-100")}>
                                    <h3 className={cn("text-xs font-bold mb-3", isDark ? "text-white/60" : "text-slate-500")}>نتائج البحث</h3>
                                    {supervisorSearchResults.length === 0 && !supervisorSearching ? (
                                        <p className={cn("text-xs text-center py-4", isDark ? "text-white/40" : "text-slate-400")}>لا توجد نتائج</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {supervisorSearchResults.map(profile => {
                                                const isSupervisor = currentSupervisors.some(s => s.id === profile.id);
                                                return (
                                                    <div key={profile.id} className={cn(
                                                        "flex items-center justify-between p-3 rounded-xl border transition-all",
                                                        isSupervisor
                                                            ? isDark ? "bg-emerald-500/10 border-emerald-500/20" : "bg-emerald-50 border-emerald-200"
                                                            : isDark ? "bg-white/5 border-white/10" : "bg-white border-slate-200"
                                                    )}>
                                                        <div className="min-w-0 flex-1 text-right">
                                                            <p className={cn("text-sm font-bold truncate", isDark ? "text-white" : "text-slate-800")}>{profile.full_name}</p>
                                                            <p className={cn("text-[10px]", isDark ? "text-white/40" : "text-slate-400")}>
                                                                رقم الوظيفة: {profile.job_number || 'غير متوفر'}
                                                            </p>
                                                        </div>
                                                        <button
                                                            onClick={() => handleToggleSupervisor(profile.id, !isSupervisor)}
                                                            disabled={togglingSupId === profile.id}
                                                            className={cn(
                                                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50 shrink-0 mr-3",
                                                                isSupervisor
                                                                    ? "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20"
                                                                    : "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600"
                                                            )}
                                                        >
                                                            {togglingSupId === profile.id ? (
                                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            ) : isSupervisor ? (
                                                                <><UserMinus className="w-3.5 h-3.5" /> إزالة</>
                                                            ) : (
                                                                <><UserPlus className="w-3.5 h-3.5" /> تعيين</>
                                                            )}
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Current Supervisors List */}
                            <div className="p-4">
                                <h3 className={cn("text-xs font-bold mb-3", isDark ? "text-emerald-400" : "text-emerald-700")}>
                                    المشرفون الحاليون ({currentSupervisors.length})
                                </h3>
                                {supervisorsLoading ? (
                                    <div className="flex items-center justify-center p-6">
                                        <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
                                    </div>
                                ) : currentSupervisors.length === 0 ? (
                                    <p className={cn("text-xs text-center py-4", isDark ? "text-white/40" : "text-slate-400")}>لا يوجد مشرفون حالياً</p>
                                ) : (
                                    <div className="space-y-2">
                                        {currentSupervisors.map(sup => (
                                            <div key={sup.id} className={cn(
                                                "flex items-center justify-between p-3 rounded-xl border",
                                                isDark ? "bg-emerald-500/5 border-emerald-500/15" : "bg-emerald-50/50 border-emerald-200/60"
                                            )}>
                                                <div className="min-w-0 flex-1 text-right">
                                                    <p className={cn("text-sm font-bold truncate", isDark ? "text-white" : "text-slate-800")}>{sup.full_name}</p>
                                                    <p className={cn("text-[10px]", isDark ? "text-white/40" : "text-slate-400")}>
                                                        رقم الوظيفة: {sup.job_number || 'غير متوفر'}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleToggleSupervisor(sup.id, false)}
                                                    disabled={togglingSupId === sup.id}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 transition-all active:scale-95 disabled:opacity-50 shrink-0 mr-3"
                                                >
                                                    {togglingSupId === sup.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><UserMinus className="w-3.5 h-3.5" /> إزالة</>}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className={cn("p-4 border-t flex justify-end", isDark ? "border-white/10" : "border-slate-100")}>
                            <button onClick={() => setShowSupervisorModal(false)} className="px-6 py-2 bg-slate-500 hover:bg-slate-600 text-white font-bold text-sm rounded-xl transition-all">إغلاق</button>
                        </div>
                    </div>
                </div>
            )}

            {showStudentsModal && (
                <TrainingStudentsModal
                    onClose={() => {
                        setShowStudentsModal(false);
                        loadResults();
                    }}
                    theme={theme}
                />
            )}


                    {/* ── تحكم الاختبار ── */}
                    <div className={cn(
                        "rounded-2xl p-4 border space-y-4",
                        isDark ? "bg-gradient-to-br from-emerald-950/20 to-teal-950/10 border-emerald-500/15" : "bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200/60"
                    )}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={cn("p-2 rounded-xl", isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-600")}>
                                    {settings?.exam_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                                </div>
                                <div>
                                    <h3 className={cn("text-sm font-bold", isDark ? "text-emerald-300" : "text-emerald-900")}>حالة الاختبار</h3>
                                    <p className={cn("text-xs", isDark ? "text-white/50" : "text-emerald-700/70")}>
                                        {settings?.exam_active ? 'الاختبار مفعّل ومتاح للمتدربين' : 'الاختبار متوقف حالياً'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleToggleExam}
                                disabled={toggling || settingsLoading}
                                className={cn(
                                    "px-4 py-2 rounded-xl font-bold text-xs transition-all active:scale-95 disabled:opacity-50",
                                    settings?.exam_active
                                        ? "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20"
                                        : "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600"
                                )}
                            >
                                {toggling ? <Loader2 className="w-4 h-4 animate-spin" /> : settings?.exam_active ? 'إيقاف' : 'تفعيل'}
                            </button>
                        </div>

                        {/* مدة الاختبار */}
                        <div className="flex items-center gap-3">
                            <Clock className={cn("w-4 h-4", isDark ? "text-white/40" : "text-slate-400")} />
                            <input
                                type="number"
                                min={1}
                                max={120}
                                value={durationInput}
                                onChange={e => setDurationInput(e.target.value)}
                                className={cn(
                                    "w-20 p-2 rounded-lg border text-sm text-center font-mono",
                                    isDark ? "bg-white/5 border-white/10 text-white" : "bg-white border-slate-200 text-slate-800"
                                )}
                            />
                            <span className={cn("text-xs", isDark ? "text-white/50" : "text-slate-500")}>دقيقة</span>
                            <button
                                onClick={handleSaveDuration}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                    isDark ? "bg-white/10 text-white/70 hover:bg-white/20" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                )}
                            >
                                تحديث
                            </button>
                        </div>
                    </div>




                    {/* ── نتائج الاختبارات ── */}
                    <SectionHeader title="نتائج الاختبارات" icon={Trophy} isOpen={openSection === 'results'} onClick={() => toggleSection('results')} color="emerald" />
                    {openSection === 'results' && (
                        <div className={cn(
                            "rounded-xl border p-4 space-y-6 animate-in fade-in slide-in-from-top-2 duration-300",
                            isDark ? "bg-white/5 border-white/10" : "bg-white border-slate-200"
                        )}>
                            {resultsLoading ? (
                                <div className="flex items-center justify-center p-6">
                                    <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                                </div>
                            ) : students.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-8 space-y-3 opacity-60">
                                    <Trophy className="w-12 h-12 text-slate-400" />
                                    <p className="text-sm font-bold text-slate-500">
                                        لم يتم تحديد طلبة مشاركين بعد
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <p className={cn("text-sm font-bold text-center", isDark ? "text-emerald-300" : "text-emerald-700")}>
                                        ( عدد الطلبة الذين انهوا الاختبار {results.length} من العدد الاجمالي {students.length} )
                                    </p>
                                    <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                                        {(() => {
                                            const sortedStudents = [...students].sort((a, b) => {
                                                const resultA = results.find(r => r.student_id === a.id);
                                                const resultB = results.find(r => r.student_id === b.id);

                                                if (resultA && resultB) {
                                                    if (resultA.score !== resultB.score) {
                                                        return resultB.score - resultA.score;
                                                    }
                                                    const durA = resultA.duration_seconds || Infinity;
                                                    const durB = resultB.duration_seconds || Infinity;
                                                    return durA - durB;
                                                }

                                                if (resultA && !resultB) return -1;
                                                if (!resultA && resultB) return 1;

                                                return a.full_name.localeCompare(b.full_name);
                                            });

                                            return sortedStudents.map(student => {
                                                const result = results.find(r => r.student_id === student.id);
                                                if (result) {
                                                    const percentage = Math.round((result.score / result.total_questions) * 100);
                                                    const grade = calculateGrade(percentage);
                                                    return (
                                                        <div key={student.id} onClick={() => setSelectedResult(result)} className={cn(
                                                            "relative p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.01] hover:shadow-md text-right",
                                                            isDark ? "bg-white/5 border-white/10 hover:bg-white/10" : "bg-white border-slate-200 hover:border-emerald-300"
                                                        )}>
                                                            {/* Score, Grade and Delete Button (Top Left) */}
                                                            <div className="absolute top-4 left-4 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                                <button
                                                                    onClick={() => handleDeleteResult(result.id)}
                                                                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                                                                    title="حذف النتيجة لإعادة الاختبار"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                                <span className={cn(
                                                                    "px-2 py-1 rounded-lg text-[10px] font-bold",
                                                                    isDark ? "bg-emerald-500/15 text-emerald-300" : "bg-emerald-100 text-emerald-700"
                                                                )}>
                                                                    {EXAM_GRADE_LABELS[grade]}
                                                                </span>
                                                                <span className={cn(
                                                                    "px-3 py-1.5 rounded-lg text-sm font-bold",
                                                                    result.score >= (result.total_questions / 2)
                                                                        ? isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700"
                                                                        : isDark ? "bg-red-500/20 text-red-400" : "bg-red-100 text-red-700"
                                                                )} dir="ltr">
                                                                    {result.score} / {result.total_questions}
                                                                </span>
                                                            </div>

                                                            <div className="min-w-0 ml-36">
                                                                <p className={cn("text-base font-black truncate", isDark ? "text-white" : "text-slate-800")}>{student.full_name}</p>
                                                                <p className={cn("text-sm mt-1.5 font-bold", isDark ? "text-white/70" : "text-slate-600")}>
                                                                    {student.institution_name} — {student.department}
                                                                </p>
                                                                <p className={cn("text-xs mt-1", isDark ? "text-white/50" : "text-slate-500")}>
                                                                    الوقت الاجمالي للاختبار <span className="font-mono" dir="ltr">{result.duration_seconds ? `${Math.floor(result.duration_seconds / 60)}:${(result.duration_seconds % 60).toFixed(2).padStart(5, '0')}` : 'غير متوفر'}</span> — نسبة الاجابة = <span className="font-mono" dir="ltr">{result.score} / {result.total_questions}</span> — التقدير: {EXAM_GRADE_LABELS[grade]}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    );
                                                } else {
                                                    return (
                                                        <div key={student.id} className={cn(
                                                            "flex items-center justify-between p-3 rounded-lg border opacity-60 grayscale cursor-not-allowed",
                                                            isDark ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-100"
                                                        )}>
                                                            <div className="min-w-0 flex-1 text-right">
                                                                <p className={cn("text-sm font-bold truncate", isDark ? "text-white" : "text-slate-800")}>{student.full_name}</p>
                                                                <p className={cn("text-[10px]", isDark ? "text-white/40" : "text-slate-400")}>
                                                                    {student.institution_name} — {student.department} — قيد الانتظار ولم يكمل الاختبار
                                                                </p>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                            });
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}


            {/* Modal for viewing exam details */}
            {selectedResult && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedResult(null)} />
                    <div className={cn(
                        "relative w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200",
                        isDark ? 'bg-zinc-900 text-white border border-white/10' : 'bg-white text-slate-900 border border-slate-200'
                    )}>
                        <div className={cn("p-4 border-b flex items-center justify-between", isDark ? "border-white/10" : "border-slate-100")}>
                            <div>
                                <h2 className="text-lg font-bold">تفاصيل إجابات الطالب</h2>
                                <p className={cn("text-xs mt-1", isDark ? "text-white/60" : "text-slate-500")}>
                                    النتيجة: {selectedResult.score}/{selectedResult.total_questions}
                                    {' — '}التقدير: {EXAM_GRADE_LABELS[calculateGrade(Math.round((selectedResult.score / selectedResult.total_questions) * 100))]}
                                </p>
                            </div>
                            <button onClick={() => setSelectedResult(null)} className="p-2 rounded-full hover:bg-red-500/10 text-red-400 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar text-right">
                            {selectedResult.exam_details ? (
                                selectedResult.exam_details.questions.map((q, i) => {
                                    const userAnswer = selectedResult.exam_details!.answers[i];
                                    const isCorrect = userAnswer === q.correctIndex;
                                    return (
                                        <div key={i} className={cn(
                                            "rounded-xl border p-4",
                                            isCorrect
                                                ? isDark ? "border-emerald-500/20 bg-emerald-500/5" : "border-emerald-200 bg-emerald-50/50"
                                                : isDark ? "border-red-500/20 bg-red-500/5" : "border-red-200 bg-red-50/50"
                                        )}>
                                            <div className="flex items-start gap-2 mb-3">
                                                {isCorrect
                                                    ? <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
                                                    : <XCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                                                }
                                                <span className={cn("text-sm font-bold leading-relaxed", isDark ? "text-white" : "text-slate-800")}>
                                                    {i + 1}. {q.question}
                                                </span>
                                            </div>
                                            <div className="mr-7 space-y-1.5">
                                                {q.options.map((opt, j) => (
                                                    <div key={j} className={cn(
                                                        "text-xs px-3 py-2 rounded-lg transition-colors",
                                                        j === q.correctIndex
                                                            ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/30"
                                                            : j === userAnswer && j !== q.correctIndex
                                                                ? "bg-red-500/20 text-red-700 dark:text-red-300 line-through border border-red-500/30"
                                                                : isDark ? "text-white/50 bg-white/5" : "text-slate-500 bg-slate-50"
                                                    )}>
                                                        {opt}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="p-8 text-center">
                                    <Trophy className="w-12 h-12 mx-auto text-emerald-500/50 mb-3" />
                                    <p className={cn("font-bold", isDark ? "text-white/60" : "text-slate-500")}>لا توجد تفاصيل لهذا الاختبار</p>
                                    <p className={cn("text-xs mt-2", isDark ? "text-white/40" : "text-slate-400")}>الاختبارات القديمة لا تحتوي على سجل بالأسئلة المحددة، بينما الاختبارات الجديدة سيتم حفظ تفاصيلها بالكامل هنا.</p>
                                </div>
                            )}
                        </div>
                        <div className={cn("p-4 border-t flex justify-end", isDark ? "border-white/10" : "border-slate-100")}>
                            <button onClick={() => setSelectedResult(null)} className="px-6 py-2 bg-slate-500 hover:bg-slate-600 text-white font-bold text-sm rounded-xl transition-all">إغلاق</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
