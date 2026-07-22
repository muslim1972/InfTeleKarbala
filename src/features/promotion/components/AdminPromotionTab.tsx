import { useState, useRef, useEffect, useCallback } from 'react';
import { BookOpen, FileSpreadsheet, FileText, Upload, Save, X, Loader2, ToggleLeft, ToggleRight, Clock, Trophy, Trash2, ChevronDown, CheckCircle2, GraduationCap, Shield, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { usePromotionData } from '../hooks/usePromotionData';
import { toast } from 'react-hot-toast';
import type { CourseType, PromotionResult } from '../types';
import { COURSE_TYPE_LABELS } from '../types';
import { supabase } from '../../../lib/supabase';
import { smoothScrollToId } from '../../../hooks/useSmoothScroll';
import { PromotionPermissionsModal } from './PromotionPermissionsModal';

interface AdminPromotionTabProps {
    isAdminView?: boolean;
}

/**
 * واجهة المشرف العام لإدارة دورات الترفيع
 * قسم المناهج (رفع PDF) + قسم الاختبار (رفع Excel + تفعيل/إيقاف)
 */
export const AdminPromotionTab = ({ isAdminView = false }: AdminPromotionTabProps) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const { user } = useAuth();
    const { settings, settingsLoading, updateSettings, uploadFile, deleteFile, checkFileExists, fetchResults, listCurriculaFiles } = usePromotionData();

    const [showPermissionsModal, setShowPermissionsModal] = useState(false);

    const permissionsMode = isAdminView ? 'supervisors' : 'students';
    const permissionsTitle = isAdminView ? 'تحديد المشرفين على دورة الترفيع' : 'تحديد الطلبة المشاركين';
    const permissionsSubtitle = isAdminView ? 'تحديد الموظفين كمشرفين على دورات الترفيع' : 'إضافة وتعديل أدوار الطلاب المشاركين في دورات الترفيع';
    const PermissionsIcon = isAdminView ? Shield : GraduationCap;

    const [openSection, setOpenSection] = useState<'curricula' | 'exams' | 'results' | null>(null);

    // ── Curricula State ──
    const [currCourseType, setCurrCourseType] = useState<CourseType | null>(null);
    const [currSubject, setCurrSubject] = useState<string | null>(null);
    const [currFiles, setCurrFiles] = useState<File[]>([]);
    const [currUploading, setCurrUploading] = useState(false);
    const [currExistingFiles, setCurrExistingFiles] = useState<any[]>([]);
    const [currChecking, setCurrChecking] = useState(false);
    const [currDeleting, setCurrDeleting] = useState(false);
    const currFileRef = useRef<HTMLInputElement>(null);

    // ── Exam State (A & B) ──
    const [examCourseType, setExamCourseType] = useState<CourseType | null>(null);
    const [examSubject, setExamSubject] = useState<string | null>(null);
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
    const [results, setResults] = useState<PromotionResult[]>([]);
    const [allowedStudents, setAllowedStudents] = useState<any[]>([]);
    const [resultsLoading, setResultsLoading] = useState(false);
    const [selectedResult, setSelectedResult] = useState<PromotionResult | null>(null);

    const [resultsCourseType, setResultsCourseType] = useState<CourseType | null>(null);
    const [resultsSubjectName, setResultsSubjectName] = useState('');

    useEffect(() => {
        if (settings) {
            setDurationInput(String(settings.exam_duration_minutes));
        }
    }, [settings]);

    const prevOpenSectionRef = useRef<string | null>(null);

    useEffect(() => {
        const targetSection = openSection || prevOpenSectionRef.current;
        if (targetSection) {
            smoothScrollToId(`promo-section-${targetSection}`, 80);
        }
        prevOpenSectionRef.current = openSection;
    }, [openSection]);

    const toggleSection = (section: 'curricula' | 'exams' | 'results') => {
        setOpenSection(prev => prev === section ? null : section);
    };

    // ── فحص الملف الموجود عند تغيير المادة (مناهج) ──
    useEffect(() => {
        if (!currCourseType || !currSubject) {
            setCurrExistingFiles([]);
            return;
        }
        let cancelled = false;
        (async () => {
            setCurrChecking(true);
            const formattedDate = currSubject.includes('-') && currSubject.split('-')[0].length === 4
                ? currSubject.split('-').reverse().join('-')
                : currSubject.trim();
            const files = await listCurriculaFiles(currCourseType, formattedDate);
            if (!cancelled) {
                setCurrExistingFiles(files);
                setCurrChecking(false);
            }
        })();
        return () => { cancelled = true; };
    }, [currCourseType, currSubject, listCurriculaFiles]);

    // ── فحص الملفين الموجودين عند تغيير المادة (اختبار A & B) ──
    useEffect(() => {
        if (!examCourseType || !examSubject) {
            setExamExistingFiles({ a: false, b: false });
            return;
        }
        let cancelled = false;
        (async () => {
            setExamChecking(true);
            const formattedDate = examSubject.includes('-') && examSubject.split('-')[0].length === 4
                ? examSubject.split('-').reverse().join('-')
                : examSubject.trim();
            const [existsA, existsB] = await Promise.all([
                checkFileExists('exams', examCourseType, `${formattedDate}_A`, 'xlsx'),
                checkFileExists('exams', examCourseType, `${formattedDate}_B`, 'xlsx'),
            ]);
            if (!cancelled) {
                setExamExistingFiles({ a: existsA, b: existsB });
                setExamChecking(false);
            }
        })();
        return () => { cancelled = true; };
    }, [examCourseType, examSubject, checkFileExists]);

    // ── Curricula Handlers ──
    const handleCurrSave = async () => {
        if (!currCourseType || !currSubject || currFiles.length === 0) {
            toast.error('يرجى ملء جميع الحقول واختيار ملفات');
            return;
        }

        const formattedDate = currSubject.includes('-') && currSubject.split('-')[0].length === 4
            ? currSubject.split('-').reverse().join('-')
            : currSubject.trim();

        setCurrUploading(true);
        let allSuccess = true;
        for (const file of currFiles) {
            const result = await uploadFile('curricula', currCourseType, formattedDate, file, 'pdf');
            if (!result.success) {
                toast.error(`فشل رفع الملف ${file.name}: ${result.error}`);
                allSuccess = false;
            }
        }
        setCurrUploading(false);
        if (allSuccess) {
            toast.success(`تم رفع المناهج بنجاح لدورة يوم: ${currSubject}`);
            // تحديث القائمة
            const files = await listCurriculaFiles(currCourseType, formattedDate);
            setCurrExistingFiles(files);
            setCurrFiles([]);
            if (currFileRef.current) currFileRef.current.value = '';
        }
    };

    const handleCurrDeleteExisting = async (filename: string) => {
        if (!currCourseType || !currSubject) return;
        setCurrDeleting(true);
        const formattedDate = currSubject.includes('-') && currSubject.split('-')[0].length === 4
            ? currSubject.split('-').reverse().join('-')
            : currSubject.trim();
        const success = await deleteFile('curricula', currCourseType, formattedDate, filename);
        setCurrDeleting(false);
        if (success) {
            toast.success('تم حذف المنهاج');
            setCurrExistingFiles(prev => prev.filter(f => f.name !== filename));
        } else {
            toast.error('فشل حذف الملف');
        }
    };

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
        if (!examCourseType || !examSubject) {
            toast.error('يرجى اختيار نوع الدورة وتأريخ بدأ الدورة');
            return;
        }
        if (!examFileA || !examFileB) {
            toast.error('يجب رفع ملفي الاختبار A و B معاً');
            return;
        }
        // فحص التطابق
        setExamUploading(true);
        const identical = await areFilesIdentical(examFileA, examFileB);
        if (identical) {
            setExamUploading(false);
            toast.error('ملفا الاختبار A و B متطابقان! يجب أن يكونا مختلفين لتمييز الطلبة المتجاورين.');
            return;
        }

        const formattedDate = examSubject.includes('-') && examSubject.split('-')[0].length === 4
            ? examSubject.split('-').reverse().join('-')
            : examSubject.trim();

        // رفع الملفين بشكل متسلسل (واحد تلو الآخر لتجنب أخطاء الشبكة)
        const resultA = await uploadFile('exams', examCourseType, `${formattedDate}_A`, examFileA, 'xlsx');
        if (!resultA.success) {
            setExamUploading(false);
            toast.error(`فشل رفع اختبار A: ${resultA.error || 'خطأ غير معروف'}`);
            return;
        }
        const resultB = await uploadFile('exams', examCourseType, `${formattedDate}_B`, examFileB, 'xlsx');
        setExamUploading(false);
        if (!resultB.success) {
            toast.error(`تم رفع A بنجاح لكن فشل رفع اختبار B: ${resultB.error || 'خطأ غير معروف'}`);
            return;
        }
        toast.success(`تم رفع اختباري A و B بنجاح لدورة يوم: ${examSubject}`);
        setExamCourseType(null);
        setExamSubject(null);
        setExamFileA(null);
        setExamFileB(null);
        setExamExistingFiles({ a: false, b: false });
        if (examFileRefA.current) examFileRefA.current.value = '';
        if (examFileRefB.current) examFileRefB.current.value = '';
    };

    const handleExamDeleteExisting = async () => {
        if (!examCourseType || !examSubject) return;
        setExamDeleting(true);

        const formattedDate = examSubject.includes('-') && examSubject.split('-')[0].length === 4
            ? examSubject.split('-').reverse().join('-')
            : examSubject.trim();

        const [successA, successB] = await Promise.all([
            deleteFile('exams', examCourseType, `${formattedDate}_A`, 'xlsx'),
            deleteFile('exams', examCourseType, `${formattedDate}_B`, 'xlsx'),
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
        if (!resultsCourseType || !resultsSubjectName.trim()) {
            setResults([]);
            setAllowedStudents([]);
            return;
        }
        
        setResultsLoading(true);
        try {
            const formattedDate = resultsSubjectName.includes('-') && resultsSubjectName.split('-')[0].length === 4
                ? resultsSubjectName.split('-').reverse().join('-')
                : resultsSubjectName.trim();

            const [data, studentsRes] = await Promise.all([
                fetchResults(200),
                supabase.rpc('get_promotion_users', {
                    supervisor_mode: false,
                    p_course_type: resultsCourseType,
                    p_subject_name: formattedDate
                })
            ]);
            
            const filteredResults = data.filter(r => 
                r.course_type === resultsCourseType && 
                r.subject_name === formattedDate
            );
            
            setResults(filteredResults);
            setAllowedStudents(studentsRes.data || []);
        } catch (err) {
            console.error('Failed to load results:', err);
        }
        setResultsLoading(false);
    }, [fetchResults, resultsCourseType, resultsSubjectName]);

    useEffect(() => {
        if (openSection === 'results') loadResults();
    }, [openSection, loadResults]);

    // ── Delete Result ──
    const handleDeleteResult = async (id: string) => {
        if (!confirm('هل تريد حذف هذه النتيجة؟')) return;
        try {
            const { error } = await supabase.from('promotion_results').delete().eq('id', id);
            if (error) throw error;
            setResults(prev => prev.filter(r => r.id !== id));
            toast.success('تم حذف النتيجة');
        } catch {
            toast.error('فشل حذف النتيجة');
        }
    };

    // Helper: Dropdown select
    const DropdownField = ({ label, value, options, onChange }: {
        label: string;
        value: string | null;
        options: { value: string; label: string }[];
        onChange: (val: string) => void;
    }) => (
        <div className="space-y-1">
            <label className={cn("text-xs font-bold block", isDark ? "text-white/70" : "text-slate-600")}>{label}</label>
            <select
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                className={cn(
                    "w-full p-2.5 rounded-xl border text-sm font-bold transition-all",
                    isDark
                        ? "bg-white/5 border-white/10 text-white focus:border-amber-500/50"
                        : "bg-white border-slate-200 text-slate-800 focus:border-amber-500"
                )}
            >
                <option value="">اختر...</option>
                {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
        </div>
    );

    // مكون عرض الملف الموجود مسبقاً
    const ExistingFileBadge = ({ subject, ext, onDelete, deleting, color }: {
        folder: string; courseType: CourseType; subject: string; ext: string;
        onDelete: () => void; deleting: boolean; color: string;
    }) => (
        <div className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg border animate-in fade-in zoom-in-95 duration-200",
            isDark ? `bg-${color}-500/10 border-${color}-500/20` : `bg-${color}-50 border-${color}-200`
        )}>
            <CheckCircle2 className={cn("w-4 h-4 shrink-0", `text-${color}-500`)} />
            <span className={cn("text-xs font-bold truncate flex-1", isDark ? `text-${color}-300` : `text-${color}-700`)}>
                ملف مرفوع: {subject}.{ext}
            </span>
            <button
                onClick={onDelete}
                disabled={deleting}
                className="p-1 rounded-full hover:bg-red-500/20 text-red-400 transition-colors shrink-0 disabled:opacity-50"
                title="حذف الملف المرفوع"
            >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
        </div>
    );

    // Section header button
    const SectionHeader = ({ id, title, icon: Icon, isOpen, onClick, color }: {
        id?: string;
        title: string;
        icon: any;
        isOpen: boolean;
        onClick: () => void;
        color: string;
    }) => (
        <button
            id={id}
            onClick={onClick}
            className={cn(
                "w-full flex items-center justify-between p-4 rounded-xl border transition-all duration-300 scroll-mt-20",
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
            {/* زر تحديد أسماء الطلبة أو المشرفين */}
            <div className={cn(
                "rounded-2xl p-4 border flex flex-col sm:flex-row items-center justify-between gap-4 transition-all duration-300",
                isDark 
                    ? "bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-950 border-white/10" 
                    : "bg-white border-slate-200 shadow-xl shadow-slate-100"
            )}>
                <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-xl bg-amber-500/10 text-amber-500")}>
                        <PermissionsIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className={cn("text-sm font-bold", isDark ? "text-white" : "text-slate-800")}>{permissionsTitle}</h3>
                        <p className={cn("text-xs", isDark ? "text-white/50" : "text-slate-500")}>{permissionsSubtitle}</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowPermissionsModal(true)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-lg shadow-amber-500/20 transition-all active:scale-95 whitespace-nowrap"
                >
                    {permissionsTitle}
                </button>
            </div>

            {showPermissionsModal && (
                <PromotionPermissionsModal
                    onClose={() => setShowPermissionsModal(false)}
                    theme={theme}
                    mode={permissionsMode}
                />
            )}

            {!isAdminView && (
                <>
                    {/* ── تحكم الاختبار ── */}
                    <div className={cn(
                        "rounded-2xl p-4 border space-y-4",
                        isDark ? "bg-gradient-to-br from-amber-950/20 to-orange-950/10 border-amber-500/15" : "bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200/60"
            )}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-xl", isDark ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-600")}>
                            {settings?.exam_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                        </div>
                        <div>
                            <h3 className={cn("text-sm font-bold", isDark ? "text-amber-300" : "text-amber-900")}>حالة الاختبار</h3>
                            <p className={cn("text-xs", isDark ? "text-white/50" : "text-amber-700/70")}>
                                {settings?.exam_active ? 'الاختبار مفعّل ومتاح للموظفين' : 'الاختبار متوقف حالياً'}
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

            {/* ── قسم المناهج ── */}
            <SectionHeader id="promo-section-curricula" title="المناهج — رفع ملفات PDF" icon={BookOpen} isOpen={openSection === 'curricula'} onClick={() => toggleSection('curricula')} color="blue" />
            {openSection === 'curricula' && (
                <div className={cn(
                    "rounded-xl border p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300",
                    isDark ? "bg-white/5 border-white/10" : "bg-white border-slate-200"
                )}>
                    <DropdownField
                        label="نوع الدورة"
                        value={currCourseType}
                        options={[
                            { value: 'administrative', label: 'دورة إدارية' },
                            { value: 'technical', label: 'دورة فنية' },
                        ]}
                        onChange={val => { setCurrCourseType(val as CourseType); setCurrSubject(null); setCurrFiles([]); setCurrExistingFiles([]); }}
                    />
                    {currCourseType && (
                        <div className="space-y-1">
                            <label className={cn("text-xs font-bold block", isDark ? "text-white/70" : "text-slate-600")}>تأريخ بدأ الدورة</label>
                            <input
                                type="date"
                                value={currSubject || ''}
                                onChange={e => { setCurrSubject(e.target.value); setCurrFiles([]); }}
                                className={cn(
                                    "w-full p-2.5 rounded-xl border text-sm font-bold transition-all",
                                    isDark
                                        ? "bg-white/5 border-white/10 text-white focus:border-amber-500/50"
                                        : "bg-white border-slate-200 text-slate-800 focus:border-amber-500"
                                )}
                            />
                        </div>
                    )}

                    {/* حالة الملف الحالي */}
                    {currCourseType && currSubject && (
                        <div className="space-y-2">
                            {currChecking ? (
                                <div className="flex items-center gap-2 py-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                    <span className={cn("text-xs", isDark ? "text-white/50" : "text-slate-500")}>جاري فحص الملف...</span>
                                </div>
                            ) : (
                                <>
                                    {/* عرض الملفات المرفوعة مسبقاً */}
                                    {currExistingFiles.length > 0 && (
                                        <div className="space-y-2">
                                            <label className={cn("text-xs font-bold block", isDark ? "text-white/70" : "text-slate-600")}>
                                                الملفات المرفوعة حالياً
                                            </label>
                                            {currExistingFiles.map(f => (
                                                <ExistingFileBadge
                                                    key={f.name}
                                                    folder="curricula" courseType={currCourseType} subject={f.name} ext="pdf"
                                                    onDelete={() => handleCurrDeleteExisting(f.name)} deleting={currDeleting} color="emerald"
                                                />
                                            ))}
                                        </div>
                                    )}

                                    {/* زر تحميل ملفات جديدة */}
                                    <label className={cn("text-xs font-bold block", isDark ? "text-white/70" : "text-slate-600")}>
                                        رفع ملفات إضافية (PDF)
                                    </label>
                                    <button
                                        onClick={() => currFileRef.current?.click()}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold transition-all",
                                            isDark ? "bg-white/5 border-white/10 text-white/70 hover:bg-white/10" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                                        )}
                                    >
                                        <Upload className="w-4 h-4" />
                                        اختر ملفات
                                    </button>
                                    <input ref={currFileRef} type="file" accept=".pdf" multiple className="hidden" onChange={e => setCurrFiles(Array.from(e.target.files || []))} />
                                    
                                    {currFiles.length > 0 && (
                                        <div className="space-y-2">
                                            <label className={cn("text-xs font-bold block", isDark ? "text-white/70" : "text-slate-600")}>
                                                الملفات المحددة للرفع
                                            </label>
                                            {currFiles.map((file, i) => (
                                                <div key={i} className={cn(
                                                    "flex items-center gap-2 px-3 py-2 rounded-lg border animate-in fade-in zoom-in-95 duration-200",
                                                    isDark ? "bg-blue-500/10 border-blue-500/20" : "bg-blue-50 border-blue-200"
                                                )}>
                                                    <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                                                    <span className={cn("text-xs font-bold truncate flex-1", isDark ? "text-blue-300" : "text-blue-700")}>{file.name}</span>
                                                    <button
                                                        onClick={() => { 
                                                            setCurrFiles(prev => prev.filter((_, idx) => idx !== i));
                                                            if (currFileRef.current && currFiles.length === 1) currFileRef.current.value = '';
                                                        }}
                                                        className="p-1 rounded-full hover:bg-red-500/20 text-red-400 transition-colors shrink-0"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* أزرار الحفظ والإلغاء */}
                    {currFiles.length > 0 && (
                        <div className="flex gap-2 pt-2 animate-in fade-in duration-200">
                            <button
                                onClick={handleCurrSave}
                                disabled={currUploading}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm transition-all disabled:opacity-50 active:scale-95"
                            >
                                {currUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                حفظ
                            </button>
                            <button
                                onClick={() => { setCurrFiles([]); if (currFileRef.current) currFileRef.current.value = ''; }}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border font-bold text-sm transition-all",
                                    isDark ? "border-white/10 text-white/60 hover:bg-white/10" : "border-slate-200 text-slate-500 hover:bg-slate-100"
                                )}
                            >
                                <X className="w-4 h-4" />
                                إلغاء
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ── قسم الاختبار ── */}
            <SectionHeader id="promo-section-exams" title="الاختبار — رفع ملفات Excel" icon={FileSpreadsheet} isOpen={openSection === 'exams'} onClick={() => toggleSection('exams')} color="purple" />
            {openSection === 'exams' && (
                <div className={cn(
                    "rounded-xl border p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300",
                    isDark ? "bg-white/5 border-white/10" : "bg-white border-slate-200"
                )}>
                    <DropdownField
                        label="نوع الدورة"
                        value={examCourseType}
                        options={[
                            { value: 'administrative', label: 'دورة إدارية' },
                            { value: 'technical', label: 'دورة فنية' },
                        ]}
                        onChange={val => { setExamCourseType(val as CourseType); setExamSubject(null); setExamFileA(null); setExamFileB(null); setExamExistingFiles({ a: false, b: false }); }}
                    />
                    {examCourseType && (
                        <div className="space-y-1">
                            <label className={cn("text-xs font-bold block", isDark ? "text-white/70" : "text-slate-600")}>تأريخ بدأ الدورة</label>
                            <input
                                type="date"
                                value={examSubject || ''}
                                onChange={e => { setExamSubject(e.target.value); setExamFileA(null); setExamFileB(null); }}
                                className={cn(
                                    "w-full p-2.5 rounded-xl border text-sm font-bold transition-all",
                                    isDark
                                        ? "bg-white/5 border-white/10 text-white focus:border-amber-500/50"
                                        : "bg-white border-slate-200 text-slate-800 focus:border-amber-500"
                                )}
                            />
                        </div>
                    )}

                    {/* حالة الملفين الحاليين A & B */}
                    {examCourseType && examSubject && (
                        <div className="space-y-3">
                            {examChecking ? (
                                <div className="flex items-center gap-2 py-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                                    <span className={cn("text-xs", isDark ? "text-white/50" : "text-slate-500")}>جاري فحص ملفات الاختبار...</span>
                                </div>
                            ) : (
                                <>
                                    {/* عرض حالة الملفات المرفوعة مسبقاً */}
                                    {(examExistingFiles.a || examExistingFiles.b) && (
                                        <div className="space-y-2">
                                            <div className={cn(
                                                "flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border",
                                                isDark ? "bg-emerald-500/10 border-emerald-500/20" : "bg-emerald-50 border-emerald-200"
                                            )}>
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                                    <span className={cn("text-xs font-bold", isDark ? "text-emerald-300" : "text-emerald-700")}>
                                                        ملفات مرفوعة: {examExistingFiles.a && examExistingFiles.b ? 'A ✓ و B ✓' : examExistingFiles.a ? 'A ✓ فقط (B مفقود ⚠)' : 'B ✓ فقط (A مفقود ⚠)'}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={handleExamDeleteExisting}
                                                    disabled={examDeleting}
                                                    className="p-1 rounded-full hover:bg-red-500/20 text-red-400 transition-colors shrink-0 disabled:opacity-50"
                                                    title="حذف كلا ملفي الاختبار"
                                                >
                                                    {examDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <p className={cn("text-[10px]", isDark ? "text-white/40" : "text-slate-400")}>
                                        صيغة الملف: 5 أعمدة (السؤال, الإجابة الأولى ✓, الثانية, الثالثة, الرابعة) — يجب أن يختلف محتوى A عن B
                                    </p>

                                    {/* ── اختبار A ── */}
                                    <div className={cn("p-3 rounded-xl border space-y-2", isDark ? "bg-purple-500/5 border-purple-500/15" : "bg-purple-50/50 border-purple-200/60")}>
                                        <label className={cn("text-xs font-bold flex items-center gap-2", isDark ? "text-purple-300" : "text-purple-700")}>
                                            <span className="px-1.5 py-0.5 rounded bg-purple-500 text-white text-[10px]">A</span>
                                            {examExistingFiles.a ? 'رفع ملف بديل — اختبار A' : 'ملف الاختبار A (Excel)'}
                                        </label>
                                        <button
                                            onClick={() => examFileRefA.current?.click()}
                                            className={cn(
                                                "flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold transition-all w-full justify-center",
                                                isDark ? "bg-white/5 border-white/10 text-white/70 hover:bg-white/10" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                                            )}
                                        >
                                            <Upload className="w-4 h-4" />
                                            {examFileA ? examFileA.name : 'اختر ملف A'}
                                        </button>
                                        <input ref={examFileRefA} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => setExamFileA(e.target.files?.[0] || null)} />
                                        {examFileA && (
                                            <div className={cn(
                                                "flex items-center gap-2 px-3 py-2 rounded-lg border animate-in fade-in zoom-in-95 duration-200",
                                                isDark ? "bg-purple-500/10 border-purple-500/20" : "bg-purple-50 border-purple-200"
                                            )}>
                                                <FileSpreadsheet className="w-4 h-4 text-purple-500 shrink-0" />
                                                <span className={cn("text-xs font-bold truncate flex-1", isDark ? "text-purple-300" : "text-purple-700")}>{examFileA.name}</span>
                                                <button
                                                    onClick={() => { setExamFileA(null); if (examFileRefA.current) examFileRefA.current.value = ''; }}
                                                    className="p-1 rounded-full hover:bg-red-500/20 text-red-400 transition-colors shrink-0"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* ── اختبار B ── */}
                                    <div className={cn("p-3 rounded-xl border space-y-2", isDark ? "bg-indigo-500/5 border-indigo-500/15" : "bg-indigo-50/50 border-indigo-200/60")}>
                                        <label className={cn("text-xs font-bold flex items-center gap-2", isDark ? "text-indigo-300" : "text-indigo-700")}>
                                            <span className="px-1.5 py-0.5 rounded bg-indigo-500 text-white text-[10px]">B</span>
                                            {examExistingFiles.b ? 'رفع ملف بديل — اختبار B' : 'ملف الاختبار B (Excel)'}
                                        </label>
                                        <button
                                            onClick={() => examFileRefB.current?.click()}
                                            className={cn(
                                                "flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold transition-all w-full justify-center",
                                                isDark ? "bg-white/5 border-white/10 text-white/70 hover:bg-white/10" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                                            )}
                                        >
                                            <Upload className="w-4 h-4" />
                                            {examFileB ? examFileB.name : 'اختر ملف B'}
                                        </button>
                                        <input ref={examFileRefB} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => setExamFileB(e.target.files?.[0] || null)} />
                                        {examFileB && (
                                            <div className={cn(
                                                "flex items-center gap-2 px-3 py-2 rounded-lg border animate-in fade-in zoom-in-95 duration-200",
                                                isDark ? "bg-indigo-500/10 border-indigo-500/20" : "bg-indigo-50 border-indigo-200"
                                            )}>
                                                <FileSpreadsheet className="w-4 h-4 text-indigo-500 shrink-0" />
                                                <span className={cn("text-xs font-bold truncate flex-1", isDark ? "text-indigo-300" : "text-indigo-700")}>{examFileB.name}</span>
                                                <button
                                                    onClick={() => { setExamFileB(null); if (examFileRefB.current) examFileRefB.current.value = ''; }}
                                                    className="p-1 rounded-full hover:bg-red-500/20 text-red-400 transition-colors shrink-0"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* أزرار الحفظ والإلغاء — تظهر عند اختيار أي ملف */}
                    {(examFileA || examFileB) && (
                        <div className="flex gap-2 pt-2 animate-in fade-in duration-200">
                            <button
                                onClick={handleExamSave}
                                disabled={examUploading}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm transition-all disabled:opacity-50 active:scale-95"
                            >
                                {examUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                حفظ اختبار A و B
                            </button>
                            <button
                                onClick={() => { setExamFileA(null); setExamFileB(null); if (examFileRefA.current) examFileRefA.current.value = ''; if (examFileRefB.current) examFileRefB.current.value = ''; }}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border font-bold text-sm transition-all",
                                    isDark ? "border-white/10 text-white/60 hover:bg-white/10" : "border-slate-200 text-slate-500 hover:bg-slate-100"
                                )}
                            >
                                <X className="w-4 h-4" />
                                إلغاء
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ── نتائج الاختبارات ── */}
            <SectionHeader id="promo-section-results" title="نتائج الاختبارات" icon={Trophy} isOpen={openSection === 'results'} onClick={() => toggleSection('results')} color="emerald" />
            {openSection === 'curricula' && (
                <div className={cn(
                    "rounded-xl border p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300",
                    isDark ? "bg-white/5 border-white/10" : "bg-white border-slate-200"
                )}>
                    <DropdownField
                        label="نوع الدورة"
                        value={currCourseType}
                        options={[
                            { value: 'administrative', label: 'دورة إدارية' },
                            { value: 'technical', label: 'دورة فنية' },
                        ]}
                        onChange={val => { setCurrCourseType(val as CourseType); setCurrSubject(null); setCurrFiles([]); setCurrExistingFiles([]); }}
                    />
                    {currCourseType && (
                        <div className="space-y-1">
                            <label className={cn("text-xs font-bold block", isDark ? "text-white/70" : "text-slate-600")}>تأريخ بدأ الدورة</label>
                            <input
                                type="date"
                                value={currSubject || ''}
                                onChange={e => { setCurrSubject(e.target.value); setCurrFiles([]); }}
                                className={cn(
                                    "w-full p-2.5 rounded-xl border text-sm font-bold transition-all",
                                    isDark
                                        ? "bg-white/5 border-white/10 text-white focus:border-amber-500/50"
                                        : "bg-white border-slate-200 text-slate-800 focus:border-amber-500"
                                )}
                            />
                        </div>
                    )}

                    {/* حالة الملف الحالي */}
                    {currCourseType && currSubject && (
                        <div className="space-y-2">
                            {currChecking ? (
                                <div className="flex items-center gap-2 py-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                    <span className={cn("text-xs", isDark ? "text-white/50" : "text-slate-500")}>جاري فحص الملف...</span>
                                </div>
                            ) : (
                                <>
                                    {/* عرض الملفات المرفوعة مسبقاً */}
                                    {currExistingFiles.length > 0 && (
                                        <div className="space-y-2">
                                            <label className={cn("text-xs font-bold block", isDark ? "text-white/70" : "text-slate-600")}>
                                                الملفات المرفوعة حالياً
                                            </label>
                                            {currExistingFiles.map(f => (
                                                <ExistingFileBadge
                                                    key={f.name}
                                                    folder="curricula" courseType={currCourseType} subject={f.name} ext="pdf"
                                                    onDelete={() => handleCurrDeleteExisting(f.name)} deleting={currDeleting} color="emerald"
                                                />
                                            ))}
                                        </div>
                                    )}

                                    {/* زر تحميل ملفات جديدة */}
                                    <label className={cn("text-xs font-bold block", isDark ? "text-white/70" : "text-slate-600")}>
                                        رفع ملفات إضافية (PDF)
                                    </label>
                                    <button
                                        onClick={() => currFileRef.current?.click()}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold transition-all",
                                            isDark ? "bg-white/5 border-white/10 text-white/70 hover:bg-white/10" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                                        )}
                                    >
                                        <Upload className="w-4 h-4" />
                                        اختر ملفات
                                    </button>
                                    <input ref={currFileRef} type="file" accept=".pdf" multiple className="hidden" onChange={e => setCurrFiles(Array.from(e.target.files || []))} />
                                    
                                    {currFiles.length > 0 && (
                                        <div className="space-y-2">
                                            <label className={cn("text-xs font-bold block", isDark ? "text-white/70" : "text-slate-600")}>
                                                الملفات المحددة للرفع
                                            </label>
                                            {currFiles.map((file, i) => (
                                                <div key={i} className={cn(
                                                    "flex items-center gap-2 px-3 py-2 rounded-lg border animate-in fade-in zoom-in-95 duration-200",
                                                    isDark ? "bg-blue-500/10 border-blue-500/20" : "bg-blue-50 border-blue-200"
                                                )}>
                                                    <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                                                    <span className={cn("text-xs font-bold truncate flex-1", isDark ? "text-blue-300" : "text-blue-700")}>{file.name}</span>
                                                    <button
                                                        onClick={() => { 
                                                            setCurrFiles(prev => prev.filter((_, idx) => idx !== i));
                                                            if (currFileRef.current && currFiles.length === 1) currFileRef.current.value = '';
                                                        }}
                                                        className="p-1 rounded-full hover:bg-red-500/20 text-red-400 transition-colors shrink-0"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* أزرار الحفظ والإلغاء */}
                    {currFiles.length > 0 && (
                        <div className="flex gap-2 pt-2 animate-in fade-in duration-200">
                            <button
                                onClick={handleCurrSave}
                                disabled={currUploading}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm transition-all disabled:opacity-50 active:scale-95"
                            >
                                {currUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                حفظ
                            </button>
                            <button
                                onClick={() => { setCurrFiles([]); if (currFileRef.current) currFileRef.current.value = ''; }}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border font-bold text-sm transition-all",
                                    isDark ? "border-white/10 text-white/60 hover:bg-white/10" : "border-slate-200 text-slate-500 hover:bg-slate-100"
                                )}
                            >
                                <X className="w-4 h-4" />
                                إلغاء
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ── قسم الاختبار ── */}
            <SectionHeader title="الاختبار — رفع ملفات Excel" icon={FileSpreadsheet} isOpen={openSection === 'exams'} onClick={() => toggleSection('exams')} color="purple" />
            {openSection === 'exams' && (
                <div className={cn(
                    "rounded-xl border p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300",
                    isDark ? "bg-white/5 border-white/10" : "bg-white border-slate-200"
                )}>
                    <DropdownField
                        label="نوع الدورة"
                        value={examCourseType}
                        options={[
                            { value: 'administrative', label: 'دورة إدارية' },
                            { value: 'technical', label: 'دورة فنية' },
                        ]}
                        onChange={val => { setExamCourseType(val as CourseType); setExamSubject(null); setExamFileA(null); setExamFileB(null); setExamExistingFiles({ a: false, b: false }); }}
                    />
                    {examCourseType && (
                        <div className="space-y-1">
                            <label className={cn("text-xs font-bold block", isDark ? "text-white/70" : "text-slate-600")}>تأريخ بدأ الدورة</label>
                            <input
                                type="date"
                                value={examSubject || ''}
                                onChange={e => { setExamSubject(e.target.value); setExamFileA(null); setExamFileB(null); }}
                                className={cn(
                                    "w-full p-2.5 rounded-xl border text-sm font-bold transition-all",
                                    isDark
                                        ? "bg-white/5 border-white/10 text-white focus:border-amber-500/50"
                                        : "bg-white border-slate-200 text-slate-800 focus:border-amber-500"
                                )}
                            />
                        </div>
                    )}

                    {/* حالة الملفين الحاليين A & B */}
                    {examCourseType && examSubject && (
                        <div className="space-y-3">
                            {examChecking ? (
                                <div className="flex items-center gap-2 py-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                                    <span className={cn("text-xs", isDark ? "text-white/50" : "text-slate-500")}>جاري فحص ملفات الاختبار...</span>
                                </div>
                            ) : (
                                <>
                                    {/* عرض حالة الملفات المرفوعة مسبقاً */}
                                    {(examExistingFiles.a || examExistingFiles.b) && (
                                        <div className="space-y-2">
                                            <div className={cn(
                                                "flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border",
                                                isDark ? "bg-emerald-500/10 border-emerald-500/20" : "bg-emerald-50 border-emerald-200"
                                            )}>
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                                    <span className={cn("text-xs font-bold", isDark ? "text-emerald-300" : "text-emerald-700")}>
                                                        ملفات مرفوعة: {examExistingFiles.a && examExistingFiles.b ? 'A ✓ و B ✓' : examExistingFiles.a ? 'A ✓ فقط (B مفقود ⚠)' : 'B ✓ فقط (A مفقود ⚠)'}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={handleExamDeleteExisting}
                                                    disabled={examDeleting}
                                                    className="p-1 rounded-full hover:bg-red-500/20 text-red-400 transition-colors shrink-0 disabled:opacity-50"
                                                    title="حذف كلا ملفي الاختبار"
                                                >
                                                    {examDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <p className={cn("text-[10px]", isDark ? "text-white/40" : "text-slate-400")}>
                                        صيغة الملف: 5 أعمدة (السؤال, الإجابة الأولى ✓, الثانية, الثالثة, الرابعة) — يجب أن يختلف محتوى A عن B
                                    </p>

                                    {/* ── اختبار A ── */}
                                    <div className={cn("p-3 rounded-xl border space-y-2", isDark ? "bg-purple-500/5 border-purple-500/15" : "bg-purple-50/50 border-purple-200/60")}>
                                        <label className={cn("text-xs font-bold flex items-center gap-2", isDark ? "text-purple-300" : "text-purple-700")}>
                                            <span className="px-1.5 py-0.5 rounded bg-purple-500 text-white text-[10px]">A</span>
                                            {examExistingFiles.a ? 'رفع ملف بديل — اختبار A' : 'ملف الاختبار A (Excel)'}
                                        </label>
                                        <button
                                            onClick={() => examFileRefA.current?.click()}
                                            className={cn(
                                                "flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold transition-all w-full justify-center",
                                                isDark ? "bg-white/5 border-white/10 text-white/70 hover:bg-white/10" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                                            )}
                                        >
                                            <Upload className="w-4 h-4" />
                                            {examFileA ? examFileA.name : 'اختر ملف A'}
                                        </button>
                                        <input ref={examFileRefA} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => setExamFileA(e.target.files?.[0] || null)} />
                                        {examFileA && (
                                            <div className={cn(
                                                "flex items-center gap-2 px-3 py-2 rounded-lg border animate-in fade-in zoom-in-95 duration-200",
                                                isDark ? "bg-purple-500/10 border-purple-500/20" : "bg-purple-50 border-purple-200"
                                            )}>
                                                <FileSpreadsheet className="w-4 h-4 text-purple-500 shrink-0" />
                                                <span className={cn("text-xs font-bold truncate flex-1", isDark ? "text-purple-300" : "text-purple-700")}>{examFileA.name}</span>
                                                <button
                                                    onClick={() => { setExamFileA(null); if (examFileRefA.current) examFileRefA.current.value = ''; }}
                                                    className="p-1 rounded-full hover:bg-red-500/20 text-red-400 transition-colors shrink-0"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* ── اختبار B ── */}
                                    <div className={cn("p-3 rounded-xl border space-y-2", isDark ? "bg-indigo-500/5 border-indigo-500/15" : "bg-indigo-50/50 border-indigo-200/60")}>
                                        <label className={cn("text-xs font-bold flex items-center gap-2", isDark ? "text-indigo-300" : "text-indigo-700")}>
                                            <span className="px-1.5 py-0.5 rounded bg-indigo-500 text-white text-[10px]">B</span>
                                            {examExistingFiles.b ? 'رفع ملف بديل — اختبار B' : 'ملف الاختبار B (Excel)'}
                                        </label>
                                        <button
                                            onClick={() => examFileRefB.current?.click()}
                                            className={cn(
                                                "flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold transition-all w-full justify-center",
                                                isDark ? "bg-white/5 border-white/10 text-white/70 hover:bg-white/10" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                                            )}
                                        >
                                            <Upload className="w-4 h-4" />
                                            {examFileB ? examFileB.name : 'اختر ملف B'}
                                        </button>
                                        <input ref={examFileRefB} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => setExamFileB(e.target.files?.[0] || null)} />
                                        {examFileB && (
                                            <div className={cn(
                                                "flex items-center gap-2 px-3 py-2 rounded-lg border animate-in fade-in zoom-in-95 duration-200",
                                                isDark ? "bg-indigo-500/10 border-indigo-500/20" : "bg-indigo-50 border-indigo-200"
                                            )}>
                                                <FileSpreadsheet className="w-4 h-4 text-indigo-500 shrink-0" />
                                                <span className={cn("text-xs font-bold truncate flex-1", isDark ? "text-indigo-300" : "text-indigo-700")}>{examFileB.name}</span>
                                                <button
                                                    onClick={() => { setExamFileB(null); if (examFileRefB.current) examFileRefB.current.value = ''; }}
                                                    className="p-1 rounded-full hover:bg-red-500/20 text-red-400 transition-colors shrink-0"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* أزرار الحفظ والإلغاء — تظهر عند اختيار أي ملف */}
                    {(examFileA || examFileB) && (
                        <div className="flex gap-2 pt-2 animate-in fade-in duration-200">
                            <button
                                onClick={handleExamSave}
                                disabled={examUploading}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm transition-all disabled:opacity-50 active:scale-95"
                            >
                                {examUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                حفظ اختبار A و B
                            </button>
                            <button
                                onClick={() => { setExamFileA(null); setExamFileB(null); if (examFileRefA.current) examFileRefA.current.value = ''; if (examFileRefB.current) examFileRefB.current.value = ''; }}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border font-bold text-sm transition-all",
                                    isDark ? "border-white/10 text-white/60 hover:bg-white/10" : "border-slate-200 text-slate-500 hover:bg-slate-100"
                                )}
                            >
                                <X className="w-4 h-4" />
                                إلغاء
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ── نتائج الاختبارات ── */}
            <SectionHeader title="نتائج الاختبارات" icon={Trophy} isOpen={openSection === 'results'} onClick={() => toggleSection('results')} color="emerald" />
            {openSection === 'results' && (
                <div className={cn(
                    "rounded-xl border p-4 space-y-6 animate-in fade-in slide-in-from-top-2 duration-300",
                    isDark ? "bg-white/5 border-white/10" : "bg-white border-slate-200"
                )}>
                    {/* Course Filter */}
                    <div className={cn("grid grid-cols-2 gap-4 p-4 rounded-xl border", isDark ? "border-emerald-500/20 bg-emerald-500/5" : "border-emerald-200 bg-emerald-50")}>
                        <div className="space-y-2">
                            <label className="text-sm font-bold block">اختر نوع الدورة لاستعراض النتائج</label>
                            <select
                                value={resultsCourseType || ''}
                                onChange={e => setResultsCourseType(e.target.value as CourseType)}
                                className={cn(
                                    "w-full h-10 px-3 rounded-lg border text-sm appearance-none outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-right",
                                    isDark ? "bg-black/20 border-white/10" : "bg-white border-gray-200"
                                )}
                                dir="rtl"
                            >
                                <option value="" disabled>اختر نوع الدورة...</option>
                                <option value="technical">فنية</option>
                                <option value="administrative">إدارية</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold block">تاريخ الدورة</label>
                            <input
                                type="date"
                                value={resultsSubjectName}
                                onChange={e => setResultsSubjectName(e.target.value)}
                                className={cn(
                                    "w-full h-10 px-3 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-right",
                                    isDark ? "bg-black/20 border-white/10" : "bg-white border-gray-200"
                                )}
                                dir="ltr"
                            />
                        </div>
                    </div>

                    {(!resultsCourseType || !resultsSubjectName.trim()) ? (
                        <div className="flex flex-col items-center justify-center p-8 space-y-3 opacity-60">
                            <Trophy className="w-12 h-12 text-slate-400" />
                            <p className="text-sm font-bold text-slate-500">
                                الرجاء اختيار نوع الدورة وتاريخها أولاً لاستعراض الطلبة ونتائجهم
                            </p>
                        </div>
                    ) : resultsLoading ? (
                        <div className="flex items-center justify-center p-6">
                            <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                        </div>
                    ) : allowedStudents.length === 0 ? (
                        <p className={cn("text-center text-sm p-6", isDark ? "text-white/40" : "text-slate-400")}>
                            لم يتم تحديد طلبة مشاركين بعد
                        </p>
                    ) : (
                        <div className="space-y-4">
                            <p className={cn("text-sm font-bold text-center", isDark ? "text-amber-300" : "text-amber-700")}>
                                ( عدد الطلبة الذين انهوا الاختبار {results.length} من العدد الاجمالي {allowedStudents.length} )
                            </p>
                            <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                                {(() => {
                                    const sortedStudents = [...allowedStudents].sort((a, b) => {
                                        const resultA = results.find(r => r.user_id === a.id);
                                        const resultB = results.find(r => r.user_id === b.id);
                                        
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
                                        const result = results.find(r => r.user_id === student.id);
                                    if (result) {
                                        return (
                                            <div key={student.id} onClick={() => setSelectedResult(result)} className={cn(
                                                "relative p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.01] hover:shadow-md text-right",
                                                isDark ? "bg-white/5 border-white/10 hover:bg-white/10" : "bg-white border-slate-200 hover:border-amber-300"
                                            )}>
                                                {/* Score and Delete Button (Top Left) */}
                                                <div className="absolute top-4 left-4 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                    <button
                                                        onClick={() => handleDeleteResult(result.id)}
                                                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                                                        title="حذف النتيجة لإعادة الاختبار"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                    <span className={cn(
                                                        "px-3 py-1.5 rounded-lg text-sm font-bold",
                                                        result.score >= (result.total_questions / 2)
                                                            ? isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700"
                                                            : isDark ? "bg-red-500/20 text-red-400" : "bg-red-100 text-red-700"
                                                    )} dir="ltr">
                                                        {result.score} / {result.total_questions}
                                                    </span>
                                                </div>

                                                <div className="min-w-0 ml-28">
                                                    <p className={cn("text-base font-black truncate", isDark ? "text-white" : "text-slate-800")}>{student.full_name}</p>
                                                    <p className={cn("text-sm mt-1.5 font-bold", isDark ? "text-white/70" : "text-slate-600")}>
                                                        {COURSE_TYPE_LABELS[result.course_type as CourseType]} والمقامة في {result.subject_name}
                                                    </p>
                                                    <p className={cn("text-xs mt-1", isDark ? "text-white/50" : "text-slate-500")}>
                                                        الوقت الاجمالي للاختبار <span className="font-mono" dir="ltr">{result.duration_seconds ? `${Math.floor(result.duration_seconds / 60)}:${(result.duration_seconds % 60).toFixed(2).padStart(5, '0')}` : 'غير متوفر'}</span> — نسبة الاجابة = <span className="font-mono" dir="ltr">{result.score} / {result.total_questions}</span>
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
                                                        رقم الوظيفة: {student.job_number || 'غير متوفر'} — قيد الانتظار ولم يكمل الاختبار
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    }
                                })})()}
                            </div>
                        </div>
                    )}
                </div>
            )}
            </>
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
                                <p className={cn("text-xs mt-1", isDark ? "text-white/60" : "text-slate-500")}>{selectedResult.user_name} — النتيجة: {selectedResult.score}/{selectedResult.total_questions}</p>
                            </div>
                            <button onClick={() => setSelectedResult(null)} className="p-2 rounded-full hover:bg-red-500/10 text-red-400 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar text-right">
                            {selectedResult.exam_details ? (
                                selectedResult.exam_details.questions.map((q: any, i: number) => {
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
                                                {q.options.map((opt: string, j: number) => (
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
                                    <Trophy className="w-12 h-12 mx-auto text-amber-500/50 mb-3" />
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
