import { useState, useRef, useEffect, useCallback } from 'react';
import { BookOpen, FileSpreadsheet, FileText, Upload, Save, X, Loader2, ToggleLeft, ToggleRight, Clock, Trophy, Trash2, ChevronDown, CheckCircle2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { usePromotionData } from '../hooks/usePromotionData';
import { toast } from 'react-hot-toast';
import type { CourseType, SubjectKey, PromotionResult } from '../types';
import { COURSE_TYPE_LABELS, SUBJECT_LABELS } from '../types';
import { supabase } from '../../../lib/supabase';

/**
 * واجهة المشرف العام لإدارة دورات الترفيع
 * قسم المناهج (رفع PDF) + قسم الاختبار (رفع Excel + تفعيل/إيقاف)
 */
export const AdminPromotionTab = () => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const { user } = useAuth();
    const { settings, settingsLoading, updateSettings, uploadFile, deleteFile, checkFileExists, fetchResults } = usePromotionData();

    const [openSection, setOpenSection] = useState<'curricula' | 'exams' | 'results' | null>(null);

    // ── Curricula State ──
    const [currCourseType, setCurrCourseType] = useState<CourseType | null>(null);
    const [currSubject, setCurrSubject] = useState<SubjectKey | null>(null);
    const [currFile, setCurrFile] = useState<File | null>(null);
    const [currUploading, setCurrUploading] = useState(false);
    const [currExistingFile, setCurrExistingFile] = useState<boolean>(false);
    const [currChecking, setCurrChecking] = useState(false);
    const [currDeleting, setCurrDeleting] = useState(false);
    const currFileRef = useRef<HTMLInputElement>(null);

    // ── Exam State ──
    const [examCourseType, setExamCourseType] = useState<CourseType | null>(null);
    const [examSubject, setExamSubject] = useState<SubjectKey | null>(null);
    const [examFile, setExamFile] = useState<File | null>(null);
    const [examUploading, setExamUploading] = useState(false);
    const [examExistingFile, setExamExistingFile] = useState<boolean>(false);
    const [examChecking, setExamChecking] = useState(false);
    const [examDeleting, setExamDeleting] = useState(false);
    const examFileRef = useRef<HTMLInputElement>(null);

    // ── Settings State ──
    const [toggling, setToggling] = useState(false);
    const [durationInput, setDurationInput] = useState('');

    // ── Results State ──
    const [results, setResults] = useState<PromotionResult[]>([]);
    const [resultsLoading, setResultsLoading] = useState(false);

    useEffect(() => {
        if (settings) {
            setDurationInput(String(settings.exam_duration_minutes));
        }
    }, [settings]);

    const toggleSection = (section: 'curricula' | 'exams' | 'results') => {
        setOpenSection(prev => prev === section ? null : section);
    };

    // ── فحص الملف الموجود عند تغيير المادة (مناهج) ──
    useEffect(() => {
        if (!currCourseType || !currSubject) {
            setCurrExistingFile(false);
            return;
        }
        let cancelled = false;
        (async () => {
            setCurrChecking(true);
            const exists = await checkFileExists('curricula', currCourseType, currSubject, 'pdf');
            if (!cancelled) {
                setCurrExistingFile(exists);
                setCurrChecking(false);
            }
        })();
        return () => { cancelled = true; };
    }, [currCourseType, currSubject, checkFileExists]);

    // ── فحص الملف الموجود عند تغيير المادة (اختبار) ──
    useEffect(() => {
        if (!examCourseType || !examSubject) {
            setExamExistingFile(false);
            return;
        }
        let cancelled = false;
        (async () => {
            setExamChecking(true);
            const exists = await checkFileExists('exams', examCourseType, examSubject, 'xlsx');
            if (!cancelled) {
                setExamExistingFile(exists);
                setExamChecking(false);
            }
        })();
        return () => { cancelled = true; };
    }, [examCourseType, examSubject, checkFileExists]);

    // ── Curricula Handlers ──
    const handleCurrSave = async () => {
        if (!currCourseType || !currSubject || !currFile) {
            toast.error('يرجى ملء جميع الحقول واختيار ملف');
            return;
        }
        setCurrUploading(true);
        const success = await uploadFile('curricula', currCourseType, currSubject, currFile, 'pdf');
        setCurrUploading(false);
        if (success) {
            toast.success(`تم رفع المنهاج بنجاح: ${SUBJECT_LABELS[currCourseType][currSubject]}`);
            // تفريغ الحقول مع الإبقاء على القسم مفتوح
            setCurrCourseType(null);
            setCurrSubject(null);
            setCurrFile(null);
            setCurrExistingFile(false);
            if (currFileRef.current) currFileRef.current.value = '';
        } else {
            toast.error('فشل رفع الملف');
        }
    };

    const handleCurrDeleteExisting = async () => {
        if (!currCourseType || !currSubject) return;
        setCurrDeleting(true);
        const success = await deleteFile('curricula', currCourseType, currSubject, 'pdf');
        setCurrDeleting(false);
        if (success) {
            toast.success('تم حذف المنهاج');
            setCurrExistingFile(false);
        } else {
            toast.error('فشل حذف الملف');
        }
    };

    // ── Exam Handlers ──
    const handleExamSave = async () => {
        if (!examCourseType || !examSubject || !examFile) {
            toast.error('يرجى ملء جميع الحقول واختيار ملف');
            return;
        }
        setExamUploading(true);
        const success = await uploadFile('exams', examCourseType, examSubject, examFile, 'xlsx');
        setExamUploading(false);
        if (success) {
            toast.success(`تم رفع أسئلة الاختبار بنجاح: ${SUBJECT_LABELS[examCourseType][examSubject]}`);
            setExamCourseType(null);
            setExamSubject(null);
            setExamFile(null);
            setExamExistingFile(false);
            if (examFileRef.current) examFileRef.current.value = '';
        } else {
            toast.error('فشل رفع الملف');
        }
    };

    const handleExamDeleteExisting = async () => {
        if (!examCourseType || !examSubject) return;
        setExamDeleting(true);
        const success = await deleteFile('exams', examCourseType, examSubject, 'xlsx');
        setExamDeleting(false);
        if (success) {
            toast.success('تم حذف ملف الأسئلة');
            setExamExistingFile(false);
        } else {
            toast.error('فشل حذف الملف');
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
        const data = await fetchResults(100);
        setResults(data);
        setResultsLoading(false);
    }, [fetchResults]);

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
        folder: string; courseType: CourseType; subject: SubjectKey; ext: string;
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
            <SectionHeader title="المناهج — رفع ملفات PDF" icon={BookOpen} isOpen={openSection === 'curricula'} onClick={() => toggleSection('curricula')} color="blue" />
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
                        onChange={val => { setCurrCourseType(val as CourseType); setCurrSubject(null); setCurrFile(null); setCurrExistingFile(false); }}
                    />
                    {currCourseType && (
                        <DropdownField
                            label="اسم المادة"
                            value={currSubject}
                            options={Object.entries(SUBJECT_LABELS[currCourseType]).map(([k, v]) => ({ value: k, label: v }))}
                            onChange={val => { setCurrSubject(val as SubjectKey); setCurrFile(null); }}
                        />
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
                                    {/* عرض الملف المرفوع مسبقاً */}
                                    {currExistingFile && (
                                        <ExistingFileBadge
                                            folder="curricula" courseType={currCourseType} subject={currSubject} ext="pdf"
                                            onDelete={handleCurrDeleteExisting} deleting={currDeleting} color="emerald"
                                        />
                                    )}

                                    {/* زر تحميل ملف جديد */}
                                    <label className={cn("text-xs font-bold block", isDark ? "text-white/70" : "text-slate-600")}>
                                        {currExistingFile ? 'رفع ملف بديل (PDF)' : 'ملف المحاضرات (PDF)'}
                                    </label>
                                    <button
                                        onClick={() => currFileRef.current?.click()}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold transition-all",
                                            isDark ? "bg-white/5 border-white/10 text-white/70 hover:bg-white/10" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                                        )}
                                    >
                                        <Upload className="w-4 h-4" />
                                        تحميل
                                    </button>
                                    <input ref={currFileRef} type="file" accept=".pdf" className="hidden" onChange={e => setCurrFile(e.target.files?.[0] || null)} />
                                    {currFile && (
                                        <div className={cn(
                                            "flex items-center gap-2 px-3 py-2 rounded-lg border animate-in fade-in zoom-in-95 duration-200",
                                            isDark ? "bg-blue-500/10 border-blue-500/20" : "bg-blue-50 border-blue-200"
                                        )}>
                                            <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                                            <span className={cn("text-xs font-bold truncate flex-1", isDark ? "text-blue-300" : "text-blue-700")}>{currFile.name}</span>
                                            <button
                                                onClick={() => { setCurrFile(null); if (currFileRef.current) currFileRef.current.value = ''; }}
                                                className="p-1 rounded-full hover:bg-red-500/20 text-red-400 transition-colors shrink-0"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* أزرار الحفظ والإلغاء */}
                    {currFile && (
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
                                onClick={() => { setCurrFile(null); if (currFileRef.current) currFileRef.current.value = ''; }}
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
                        onChange={val => { setExamCourseType(val as CourseType); setExamSubject(null); setExamFile(null); setExamExistingFile(false); }}
                    />
                    {examCourseType && (
                        <DropdownField
                            label="اسم المادة"
                            value={examSubject}
                            options={Object.entries(SUBJECT_LABELS[examCourseType]).map(([k, v]) => ({ value: k, label: v }))}
                            onChange={val => { setExamSubject(val as SubjectKey); setExamFile(null); }}
                        />
                    )}

                    {/* حالة الملف الحالي */}
                    {examCourseType && examSubject && (
                        <div className="space-y-2">
                            {examChecking ? (
                                <div className="flex items-center gap-2 py-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                                    <span className={cn("text-xs", isDark ? "text-white/50" : "text-slate-500")}>جاري فحص الملف...</span>
                                </div>
                            ) : (
                                <>
                                    {/* عرض الملف المرفوع مسبقاً */}
                                    {examExistingFile && (
                                        <ExistingFileBadge
                                            folder="exams" courseType={examCourseType} subject={examSubject} ext="xlsx"
                                            onDelete={handleExamDeleteExisting} deleting={examDeleting} color="emerald"
                                        />
                                    )}

                                    {/* زر تحميل ملف جديد */}
                                    <label className={cn("text-xs font-bold block", isDark ? "text-white/70" : "text-slate-600")}>
                                        {examExistingFile ? 'رفع ملف بديل (Excel)' : 'ملف الأسئلة والأجوبة (Excel)'}
                                    </label>
                                    <p className={cn("text-[10px]", isDark ? "text-white/40" : "text-slate-400")}>
                                        صيغة الملف: 5 أعمدة (السؤال, الإجابة الأولى ✓, الثانية, الثالثة, الرابعة)
                                    </p>
                                    <button
                                        onClick={() => examFileRef.current?.click()}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold transition-all",
                                            isDark ? "bg-white/5 border-white/10 text-white/70 hover:bg-white/10" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                                        )}
                                    >
                                        <Upload className="w-4 h-4" />
                                        تحميل
                                    </button>
                                    <input ref={examFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => setExamFile(e.target.files?.[0] || null)} />
                                    {examFile && (
                                        <div className={cn(
                                            "flex items-center gap-2 px-3 py-2 rounded-lg border animate-in fade-in zoom-in-95 duration-200",
                                            isDark ? "bg-purple-500/10 border-purple-500/20" : "bg-purple-50 border-purple-200"
                                        )}>
                                            <FileSpreadsheet className="w-4 h-4 text-purple-500 shrink-0" />
                                            <span className={cn("text-xs font-bold truncate flex-1", isDark ? "text-purple-300" : "text-purple-700")}>{examFile.name}</span>
                                            <button
                                                onClick={() => { setExamFile(null); if (examFileRef.current) examFileRef.current.value = ''; }}
                                                className="p-1 rounded-full hover:bg-red-500/20 text-red-400 transition-colors shrink-0"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* أزرار الحفظ والإلغاء */}
                    {examFile && (
                        <div className="flex gap-2 pt-2 animate-in fade-in duration-200">
                            <button
                                onClick={handleExamSave}
                                disabled={examUploading}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm transition-all disabled:opacity-50 active:scale-95"
                            >
                                {examUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                حفظ
                            </button>
                            <button
                                onClick={() => { setExamFile(null); if (examFileRef.current) examFileRef.current.value = ''; }}
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
                    "rounded-xl border p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300",
                    isDark ? "bg-white/5 border-white/10" : "bg-white border-slate-200"
                )}>
                    {resultsLoading ? (
                        <div className="flex items-center justify-center p-6">
                            <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                        </div>
                    ) : results.length === 0 ? (
                        <p className={cn("text-center text-sm p-6", isDark ? "text-white/40" : "text-slate-400")}>
                            لا توجد نتائج بعد
                        </p>
                    ) : (
                        <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                            {results.map(r => (
                                <div key={r.id} className={cn(
                                    "flex items-center justify-between p-3 rounded-lg border",
                                    isDark ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-100"
                                )}>
                                    <div className="min-w-0 flex-1">
                                        <p className={cn("text-sm font-bold truncate", isDark ? "text-white" : "text-slate-800")}>{r.user_name}</p>
                                        <p className={cn("text-[10px]", isDark ? "text-white/40" : "text-slate-400")}>
                                            {COURSE_TYPE_LABELS[r.course_type as CourseType]} — {SUBJECT_LABELS[r.course_type as CourseType]?.[r.subject_name as SubjectKey] || r.subject_name}
                                            {r.duration_seconds ? ` — ${Math.floor(r.duration_seconds / 60)}:${String(r.duration_seconds % 60).padStart(2, '0')}` : ''}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className={cn(
                                            "px-2 py-1 rounded-lg text-xs font-bold",
                                            r.score >= 5
                                                ? isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700"
                                                : isDark ? "bg-red-500/20 text-red-400" : "bg-red-100 text-red-700"
                                        )}>
                                            {r.score}/{r.total_questions}
                                        </span>
                                        <button
                                            onClick={() => handleDeleteResult(r.id)}
                                            className="p-1 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
