import { useState, useEffect } from 'react';
import {
    PieChart, Save, ArrowLeft, CheckCircle2,
    ListChecks, HelpCircle, MousePointerClick, BarChart3, Plus, Trash2, StopCircle, Edit, Archive, RefreshCw, Search
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { PollStats } from './PollStats';
import { formatDate } from '../../utils/formatDate';
import { DateInput } from '../ui/DateInput';

interface OptionDraft {
    text: string;
}

interface QuestionDraft {
    text: string;
    type: 'single' | 'multiple';
    options: OptionDraft[];
}

export function PollCreator() {
    const { user } = useAuth();
    // Phases: 'list' -> 'config' -> 'building' -> 'review' | 'stats' | 'view'
    const [phase, setPhase] = useState<'list' | 'config' | 'building' | 'review' | 'stats' | 'view'>('list');
    const [isLoading, setIsLoading] = useState(false);
    const [pollsList, setPollsList] = useState<any[]>([]);
    const [selectedPollId, setSelectedPollId] = useState<string | null>(null);

    // List View Filters
    const [showDeleted, setShowDeleted] = useState(false);
    const [dateFilter, setDateFilter] = useState({ start: '', end: '' });

    // Phase 1: Config
    const [pollTitle, setPollTitle] = useState('');
    const [totalQuestions, setTotalQuestions] = useState(1);

    // Phase 2: Building
    const [currentStep, setCurrentStep] = useState(1); // 1-based index
    const [currentQuestionText, setCurrentQuestionText] = useState('');
    const [currentQuestionType, setCurrentQuestionType] = useState<'single' | 'multiple'>('single');
    const [currentOptionsCount, setCurrentOptionsCount] = useState(2);
    const [currentOptions, setCurrentOptions] = useState<OptionDraft[]>([{ text: '' }, { text: '' }]);

    // Storage
    const [collectedQuestions, setCollectedQuestions] = useState<QuestionDraft[]>([]);

    // --- Effects ---
    useEffect(() => {
        if (phase === 'list') {
            fetchPolls();
        }
    }, [phase, showDeleted]); // Re-fetch when filter changes

    const fetchPolls = async () => {
        setIsLoading(true);
        let query = supabase
            .from('polls')
            .select('*')
            .order('created_at', { ascending: false });

        if (showDeleted) {
            query = query.eq('is_deleted', true);
        } else {
            // Normal view: Show only existing (active or inactive)
            query = query.eq('is_deleted', false);
        }

        const { data, error } = await query;

        if (error) console.error(error);
        else setPollsList(data || []);
        setIsLoading(false);
    };

    // --- Handlers ---

    // Toggle Active Status (Stop/Start)
    const handleToggleActive = async (id: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('polls')
                .update({ is_active: !currentStatus })
                .eq('id', id);

            if (error) throw error;

            toast.success(currentStatus ? "تم إيقاف الاستطلاع" : "تم إعادة تفعيل الاستطلاع");

            // Optimistic Update
            setPollsList(prev => prev.map(p =>
                p.id === id ? { ...p, is_active: !currentStatus } : p
            ));

        } catch (err) {
            toast.error("فشل في تحديث الحالة");
            console.error(err);
        }
    };

    // Soft Delete
    const handleDelete = async (id: string) => {
        if (!confirm("هل أنت متأكد من حذف هذا الاستطلاع؟ سيتم نقله إلى سلة المحذوفات.")) return;

        try {
            // Soft delete: set is_deleted = true AND is_active = false
            const { error } = await supabase
                .from('polls')
                .update({ is_deleted: true, is_active: false })
                .eq('id', id);

            if (error) throw error;

            toast.success("تم نقل الاستطلاع إلى المحذوفات");
            // Remove from current list view
            setPollsList(prev => prev.filter(p => p.id !== id));

        } catch (err) {
            toast.error("فشل في الحذف");
            console.error(err);
        }
    };

    // Restore from Trash
    const handleRestore = async (id: string) => {
        if (!confirm("هل تريد استعادة هذا الاستطلاع؟")) return;

        try {
            const { error } = await supabase
                .from('polls')
                .update({ is_deleted: false })
                .eq('id', id);

            if (error) throw error;

            toast.success("تم استعادة الاستطلاع");
            // Remove from deleted list
            setPollsList(prev => prev.filter(p => p.id !== id));

        } catch (err) {
            toast.error("فشل في الاستعادة");
            console.error(err);
        }
    };

    // Helper: Load specific question into inputs (for editing) OR reset
    const loadQuestionIntoState = (idx: number) => {
        if (collectedQuestions[idx]) {
            // Load existing
            const q = collectedQuestions[idx];
            setCurrentQuestionText(q.text);
            setCurrentQuestionType(q.type);
            setCurrentOptions(q.options);
            setCurrentOptionsCount(q.options.length);
        } else {
            // New Question
            resetCurrentQuestionFields();
        }
    };

    const resetCurrentQuestionFields = () => {
        setCurrentQuestionText('');
        setCurrentQuestionType('single');
        setCurrentOptionsCount(2);
        setCurrentOptions([{ text: '' }, { text: '' }]);
    };

    // Phase 1 -> 2 (With "Edit" support)
    const startBuilding = () => {
        if (!pollTitle.trim()) {
            toast.error("يرجى كتابة عنوان للاستطلاع");
            return;
        }
        if (totalQuestions < 1) {
            toast.error("يجب أن يحتوي الاستطلاع على سؤال واحد على الأقل");
            return;
        }

        // Sync collectedQuestions with totalQuestions if reduced
        if (collectedQuestions.length > totalQuestions) {
            setCollectedQuestions(prev => prev.slice(0, totalQuestions));
        }

        setPhase('building');
        // Always start at 1, but load existing if we are revisiting
        setCurrentStep(1);
        loadQuestionIntoState(0);
    };

    // Next Question or Finish
    const handleNextQuestion = () => {
        // Validation
        if (!currentQuestionText.trim()) {
            toast.error("يرجى كتابة نص السؤال");
            return;
        }
        const emptyOptions = currentOptions.filter(o => !o.text.trim());
        if (emptyOptions.length > 0) {
            toast.error("يرجى ملء جميع خيارات الاجابة");
            return;
        }

        // Save current question (Update or Add)
        const newQuestion: QuestionDraft = {
            text: currentQuestionText,
            type: currentQuestionType,
            options: [...currentOptions]
        };

        const updatedCollection = [...collectedQuestions];
        // 0-based index for array, currentStep is 1-based
        updatedCollection[currentStep - 1] = newQuestion;

        setCollectedQuestions(updatedCollection);

        if (currentStep < totalQuestions) {
            // Move to next
            const nextStep = currentStep + 1;
            setCurrentStep(nextStep);

            // Load next (if exists) or reset
            loadQuestionIntoState(nextStep - 1);

            // Scroll to top
            const formElement = document.getElementById('poll-creator-form');
            if (formElement) formElement.scrollIntoView({ behavior: 'smooth' });

        } else {
            // Finished
            setPhase('review');
        }
    };

    // Publish
    const publishPoll = async () => {
        if (!user) return;
        setIsLoading(true);

        try {
            // 1. Create Poll
            const { data: pollData, error: pollError } = await supabase
                .from('polls')
                .insert({
                    title: pollTitle,
                    description: '', // Optional
                    created_by: user.id,
                    is_active: true
                })
                .select()
                .single();

            if (pollError) throw pollError;

            // 2. Create Questions & Options
            for (let i = 0; i < collectedQuestions.length; i++) {
                const q = collectedQuestions[i];

                // Insert Question
                const { data: qData, error: qError } = await supabase
                    .from('poll_questions')
                    .insert({
                        poll_id: pollData.id,
                        question_text: q.text,
                        // question_type removed: Not in DB schema
                        allow_multiple_answers: q.type === 'multiple',
                        order_index: i
                    })
                    .select()
                    .single();

                if (qError) throw qError;

                // Insert Options
                const optionsToInsert = q.options.map((opt, idx) => ({
                    question_id: qData.id,
                    option_text: opt.text,
                    order_index: idx
                }));

                const { error: oError } = await supabase
                    .from('poll_options')
                    .insert(optionsToInsert);

                if (oError) throw oError;
            }

            toast.success("تم نشر الاستطلاع بنجاح");

            // Convert 'review' -> 'stats' or 'list'
            setPhase('list');

            // Reset
            setPollTitle('');
            setTotalQuestions(1);
            setCollectedQuestions([]);

            // Refresh list
            fetchPolls();

        } catch (error: any) {
            console.error("Publishing error:", error);
            toast.error("حدث خطأ أثناء النشر: " + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Review Phase Helpers
    const handleAddQuestion = () => {
        const newTotal = collectedQuestions.length + 1;
        setTotalQuestions(newTotal);
        handleJumpToStep(newTotal);
    };

    const handleDeleteQuestion = (index: number) => {
        if (collectedQuestions.length <= 1) {
            toast.error("لا يمكن حذف السؤال الأخير");
            return;
        }
        const updated = collectedQuestions.filter((_, i) => i !== index);
        setCollectedQuestions(updated);
        setTotalQuestions(updated.length);
    };

    const handleJumpToStep = (step: number) => {
        setPhase('building');
        setTotalQuestions(Math.max(collectedQuestions.length, step)); // Ensure total covers it
        setCurrentStep(step);
        loadQuestionIntoState(step - 1);
    };

    // View Details Logic
    const handleViewDetails = async (id: string, titleStr: string) => {
        setIsLoading(true);
        setSelectedPollId(id);
        setPollTitle(titleStr);
        try {
            // Fetch questions and options
            const { data: questions, error } = await supabase
                .from('poll_questions')
                .select(`
                    id,
                    question_text,
                    allow_multiple_answers,
                    order_index,
                    poll_options (
                        id,
                        option_text,
                        order_index
                    )
                `)
                .eq('poll_id', id)
                .order('order_index');

            if (error) throw error;

            // Map to QuestionDraft format for reuse of 'review' UI or similar
            const mapped: QuestionDraft[] = (questions || []).map(q => ({
                text: q.question_text,
                type: q.allow_multiple_answers ? 'multiple' : 'single',
                options: (q.poll_options || []).sort((a, b) => a.order_index - b.order_index).map(o => ({
                    text: o.option_text
                }))
            }));

            setCollectedQuestions(mapped);
            setPhase('view');

        } catch (err) {
            console.error(err);
            toast.error("فشل جلب تفاصيل الاستطلاع");
        } finally {
            setIsLoading(false);
        }
    };

    // --- Render ---

    if (phase === 'stats' && selectedPollId) {
        return <PollStats pollId={selectedPollId} onBack={() => { setPhase('list'); setPollsList([]); fetchPolls(); }} />;
    }

    const filteredList = pollsList.filter(p => {
        if (!dateFilter.start && !dateFilter.end) return true;
        const pDate = new Date(p.created_at).getTime();
        const start = dateFilter.start ? new Date(dateFilter.start).getTime() : 0;
        const end = dateFilter.end ? new Date(dateFilter.end).getTime() + 86400000 : Infinity; // End of day
        return pDate >= start && pDate <= end;
    });

    return (
        <div id="poll-creator-form" className="w-full max-w-4xl mx-auto">

            {phase === 'list' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="flex justify-between items-center bg-white/50 dark:bg-black/20 p-4 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            {showDeleted ? (
                                <>
                                    <Archive className="w-6 h-6 text-red-500" />
                                    أرشيف المحذوفات
                                </>
                            ) : (
                                <>
                                    <ListChecks className="w-6 h-6 text-brand-green" />
                                    سجل الاستطلاعات
                                </>
                            )}
                        </h2>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => { setShowDeleted(!showDeleted); setPollsList([]); }}
                                className={cn(
                                    "p-2 rounded-xl transition-all border",
                                    showDeleted
                                        ? "bg-gray-100 dark:bg-white/10 border-gray-200 dark:border-white/20 text-gray-900 dark:text-white"
                                        : "bg-gray-100 dark:bg-black/40 border-transparent text-gray-400 dark:text-white/40 hover:text-gray-900 dark:hover:text-white"
                                )}
                                title={showDeleted ? "عودة للاستطلاعات" : "عرض المحذوفات"}
                            >
                                <Archive className="w-5 h-5" />
                            </button>

                            {!showDeleted && (
                                <button
                                    onClick={() => setPhase('config')}
                                    className="bg-brand-green hover:bg-brand-green/90 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg hover:shadow-brand-green/20"
                                >
                                    <Plus className="w-5 h-5" />
                                    <span className="hidden md:inline">استطلاع جديد</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Filters (Archive Mode) */}
                    {showDeleted && (
                        <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/10 animate-in slide-in-from-top-2">
                            <span className="text-sm text-white/60 font-bold flex items-center gap-2">
                                <Search className="w-4 h-4" />
                                تصفية حسب التاريخ:
                            </span>
                            <DateInput
                                value={dateFilter.start}
                                onChange={val => setDateFilter({ ...dateFilter, start: val })}
                                className="bg-black/40 border-white/10 text-white text-sm"
                            />
                            <span className="text-white/40">-</span>
                            <DateInput
                                value={dateFilter.end}
                                onChange={val => setDateFilter({ ...dateFilter, end: val })}
                                className="bg-white dark:bg-black/40 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-sm"
                            />
                        </div>
                    )}

                    <div className="grid gap-4">
                        {filteredList.map((p) => (
                            <div
                                key={p.id}
                                className={cn(
                                    "rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 group transition-all cursor-pointer relative shadow-sm",
                                    p.is_active
                                        ? "bg-gradient-to-r from-white/90 to-white dark:from-white/5 dark:to-white/10 border border-brand-green/20 shadow-[0_0_15px_-5px_var(--brand-green-rgb)] hover:brightness-105"
                                        : "bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:bg-white/80 dark:hover:bg-white/10"
                                )}
                                onClick={(e) => {
                                    // Prevent triggering if clicked on action buttons
                                    if ((e.target as HTMLElement).closest('button')) return;
                                    handleViewDetails(p.id, p.title);
                                }}
                            >
                                <div>
                                    <h3 className={cn(
                                        "font-bold text-lg mb-1 transition-colors",
                                        !p.is_active && !p.is_deleted ? "text-red-400" : "text-white group-hover:text-brand-green"
                                    )}>
                                        {p.title}
                                    </h3>
                                    <div className="flex items-center gap-3 text-sm text-white/40">
                                        <span>{formatDate(p.created_at)}</span>
                                        <span className="w-1 h-1 bg-white/20 rounded-full" />
                                        <span className={cn(
                                            "px-2 py-0.5 rounded text-[10px] font-bold",
                                            p.is_deleted ? "bg-red-500/20 text-red-500" :
                                                p.is_active ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                                        )}>
                                            {p.is_deleted ? "محذوف" : p.is_active ? "نشط" : "متوقف"}
                                        </span>
                                    </div>
                                    <p className="text-xs text-brand-green mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        انقر لعرض التفاصيل
                                    </p>
                                </div>

                                <div className="flex items-center gap-2 relative z-10">
                                    {/* Actions */}

                                    {/* 1. View Stats / Print (Available for all) */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setSelectedPollId(p.id); setPhase('stats'); }}
                                        className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 p-2 rounded-lg transition-colors tooltip flex items-center gap-1.5"
                                        title={showDeleted ? "عرض / طباعة" : "النتائج"}
                                    >
                                        <BarChart3 className="w-5 h-5" />
                                        {showDeleted && <span className="text-xs font-bold">عرض</span>}
                                    </button>

                                    {/* 2. Stop/Start (Only for Active/Inactive list) */}
                                    {!showDeleted && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleToggleActive(p.id, p.is_active); }}
                                            className={cn(
                                                "p-2 rounded-lg transition-all duration-1000",
                                                p.is_active
                                                    ? "bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500"
                                                    : "bg-red-500/20 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-pulse hover:shadow-[0_0_20px_rgba(239,68,68,0.8)]"
                                            )}
                                            title={p.is_active ? "إيقاف الاستطلاع" : "إعادة تفعيل"}
                                        >
                                            {p.is_active ? <StopCircle className="w-5 h-5" /> : <RefreshCw className="w-5 h-5" />}
                                        </button>
                                    )}

                                    {/* 3. Delete / Restore */}
                                    {showDeleted ? (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleRestore(p.id); }}
                                            className="bg-green-500/10 hover:bg-green-500/20 text-green-500 p-2 rounded-lg transition-colors tooltip font-bold text-xs"
                                            title="استعادة"
                                        >
                                            استعادة
                                        </button>
                                    ) : (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                                            className="bg-red-500/10 hover:bg-red-500/20 text-red-500 p-2 rounded-lg transition-colors tooltip"
                                            title="حذف"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}

                        {filteredList.length === 0 && !isLoading && (
                            <div className="text-center py-16 text-white/30 border border-white/5 rounded-xl border-dashed">
                                {showDeleted
                                    ? "سجل المحذوفات فارغ"
                                    : "لا توجد استطلاعات هنا"}
                            </div>
                        )}
                    </div>
                </div>
            )}


            {phase === 'config' && (
                <div className="bg-white/50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden p-6 max-w-2xl mx-auto space-y-6 animate-in fade-in zoom-in duration-300 shadow-sm">
                    <button
                        onClick={() => {
                            setPhase('list');
                            setCollectedQuestions([]);
                        }}
                        className="text-white/40 hover:text-white flex items-center gap-2 text-sm transition-colors mb-4"
                    >
                        <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
                        عودة للقائمة
                    </button>

                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-brand-green/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-brand-green/20">
                            <PieChart className="w-8 h-8 text-brand-green" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">إنشاء استطلاع جديد</h3>
                        <p className="text-gray-500 dark:text-white/40 mt-2">قم بإعداد هيكل الاستطلاع وتحديد عدد الأسئلة</p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-bold text-white/70 block mb-2">عنوان الاستطلاع</label>
                            <input
                                type="text"
                                value={pollTitle}
                                onChange={e => setPollTitle(e.target.value)}
                                placeholder="مثلاً: استبيان حول جودة الخدمات الإدارية"
                                className="w-full bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:border-brand-green/50"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-bold text-white/70 block mb-2">كم سؤال تريد في هذا الاستطلاع؟</label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="number"
                                    min="1" max="20"
                                    value={totalQuestions}
                                    onChange={e => setTotalQuestions(parseInt(e.target.value) || 1)}
                                    className="w-24 bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-center text-gray-900 dark:text-white font-mono text-xl focus:outline-none focus:border-brand-green/50"
                                />
                                <span className="text-gray-500 dark:text-white/40 text-sm">سؤال</span>
                            </div>
                        </div>

                        <button
                            onClick={startBuilding}
                            className="w-full mt-4 bg-brand-green text-white font-bold py-3 rounded-xl hover:bg-brand-green/90 transition-all flex items-center justify-center gap-2"
                        >
                            <span>البدء ببناء الأسئلة</span>
                            <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
                        </button>
                    </div>
                </div>
            )}

            {phase === 'building' && (
                <div className="bg-white/50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden p-6 max-w-2xl mx-auto space-y-6 animate-in slide-in-from-right duration-300 shadow-sm">
                    <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-4">
                        <span className="text-brand-green font-bold text-lg">بناء الأسئلة</span>
                        <div className="flex items-center gap-2 text-white/60">
                            <span className="bg-white/10 px-3 py-1 rounded-lg text-white font-mono">
                                {currentStep} / {totalQuestions}
                            </span>
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-bold text-brand-green block mb-2 flex items-center gap-2">
                            <HelpCircle className="w-4 h-4" />
                            نص السؤال رقم {currentStep}
                        </label>
                        <input
                            type="text"
                            value={currentQuestionText}
                            onChange={e => setCurrentQuestionText(e.target.value)}
                            placeholder="اكتب السؤال هنا..."
                            className="w-full bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:border-brand-green/50 text-lg"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                        <div>
                            <label className="text-sm font-bold text-white/70 block mb-2 flex items-center gap-2">
                                <ListChecks className="w-4 h-4" />
                                عدد خيارات الإجابة
                            </label>
                            <div className="flex items-center bg-black/40 rounded-xl border border-white/10 p-1">
                                <button
                                    // Using a manual handler since handleOptionsCountChange is abstract in this snippet
                                    onClick={() => setCurrentOptionsCount(Math.max(2, currentOptionsCount - 1))}
                                    className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg text-gray-500 dark:text-white transition-colors"
                                >
                                    -
                                </button>
                                <div className="flex-1 text-center font-mono text-gray-900 dark:text-white text-lg font-bold">
                                    {currentOptionsCount}
                                </div>
                                <button
                                    onClick={() => setCurrentOptionsCount(Math.min(10, currentOptionsCount + 1))}
                                    className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg text-gray-500 dark:text-white transition-colors"
                                >
                                    +
                                </button>
                            </div>
                            <p className="text-xs text-white/30 mt-1">تلقائيا سيتم تحديث حقول الخيارات</p>
                        </div>

                        <div>
                            <label className="text-sm font-bold text-white/70 block mb-2 flex items-center gap-2">
                                <MousePointerClick className="w-4 h-4" />
                                نوع الاختيار
                            </label>
                            <div className="flex bg-black/40 rounded-xl border border-white/10 p-1">
                                <button
                                    onClick={() => setCurrentQuestionType('single')}
                                    className={cn(
                                        "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
                                        currentQuestionType === 'single' ? "bg-blue-500/20 text-blue-400" : "text-white/40 hover:text-white"
                                    )}
                                >
                                    خيار واحد
                                </button>
                                <button
                                    onClick={() => setCurrentQuestionType('multiple')}
                                    className={cn(
                                        "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
                                        currentQuestionType === 'multiple' ? "bg-purple-500/20 text-purple-400" : "text-white/40 hover:text-white"
                                    )}
                                >
                                    عدة خيارات
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 pt-4 border-t border-white/5 mt-6">
                        <label className="text-sm font-bold text-white/50 block mb-2">نصوص الإجابات</label>
                        {Array.from({ length: currentOptionsCount }).map((_, idx) => (
                            <div key={idx} className="flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: `${idx * 50}ms` }}>
                                <span className="bg-white/5 w-8 h-10 flex items-center justify-center rounded-lg text-white/30 text-xs font-mono">
                                    {idx + 1}
                                </span>
                                <input
                                    type="text"
                                    value={currentOptions[idx]?.text || ''}
                                    onChange={e => {
                                        const newOpts = [...currentOptions];
                                        if (!newOpts[idx]) newOpts[idx] = { text: '' };
                                        newOpts[idx].text = e.target.value;
                                        setCurrentOptions(newOpts);
                                    }}
                                    placeholder={`الخيار ${idx + 1}`}
                                    className="flex-1 bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-green/30"
                                />
                            </div>
                        ))}
                    </div>

                    <div className="pt-6 flex justify-end">
                        <button
                            onClick={handleNextQuestion}
                            className="bg-brand-green hover:bg-brand-green/90 text-white font-bold py-2 px-6 rounded-xl flex items-center gap-2 transition-all shadow-lg hover:shadow-brand-green/20"
                        >
                            <span>{currentStep === totalQuestions ? 'إتمام وإنهاء' : 'السؤال التالي'}</span>
                            <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
                        </button>
                    </div>

                </div>
            )}

            {phase === 'review' && (
                <div className="bg-white/50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden p-6 max-w-2xl mx-auto space-y-6 animate-in zoom-in duration-300 shadow-sm">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-brand-green/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-brand-green/40">
                            <CheckCircle2 className="w-8 h-8 text-brand-green" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">مراجعة الاستطلاع</h3>
                        <p className="text-gray-500 dark:text-white/40 mt-1">أنت على وشك نشر الاستطلاع التالي</p>
                    </div>

                    <div className="bg-white/50 dark:bg-black/40 rounded-xl border border-gray-200 dark:border-white/10 p-4 space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                        <div className="flex justify-between items-center border-b border-gray-200 dark:border-white/10 pb-2 mb-2">
                            <h4 className="font-bold text-lg text-gray-900 dark:text-white">{pollTitle}</h4>
                            <span className="text-xs text-brand-green font-bold bg-brand-green/10 px-2 py-1 rounded">
                                {collectedQuestions.length} أسئلة
                            </span>
                        </div>

                        {collectedQuestions.map((q, i) => (
                            <div key={i} className="bg-gray-50 dark:bg-white/5 rounded-lg p-3 group relative hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                                <div className="flex justify-between items-start mb-2 pl-8">
                                    <span className="text-brand-green font-bold text-sm">سؤال {i + 1}: {q.text}</span>
                                    <span className="text-[10px] bg-gray-200 dark:bg-white/10 px-2 py-0.5 rounded text-gray-500 dark:text-white/50">
                                        {q.type === 'single' ? 'خيار واحد' : 'عدة خيارات'}
                                    </span>
                                </div>
                                <ul className="list-disc list-inside text-xs text-gray-500 dark:text-white/60 space-y-1 mb-2">
                                    {q.options.map((opt, j) => (
                                        <li key={j}>{opt.text}</li>
                                    ))}
                                </ul>

                                {/* Action Buttons per Question */}
                                <div className="absolute top-2 left-2 flex flex-col gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleJumpToStep(i + 1)}
                                        className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-lg"
                                        title="تعديل السؤال"
                                    >
                                        <Edit className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteQuestion(i)}
                                        className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg"
                                        title="حذف السؤال"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {/* Add Question Button */}
                        <button
                            onClick={handleAddQuestion}
                            className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-white/10 rounded-xl text-gray-400 dark:text-white/40 hover:text-brand-green hover:border-brand-green/50 dark:hover:text-white dark:hover:border-white/30 hover:bg-gray-50 dark:hover:bg-white/5 transition-all flex items-center justify-center gap-2 font-bold text-sm group"
                        >
                            <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                            إضافة سؤال جديد
                        </button>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button
                            onClick={() => {
                                // Default Edit Behavior -> Go to config
                                setPhase('config');
                                // We keep collectedQuestions as is, config phase totalQuestions will update via state, but input needs to be synced ??
                                // Actually 'totalQuestions' state is master. But modifying it in config might require logic.
                                // For now, simple return to config is fine, user sees current count.
                            }}
                            className="bg-white/5 hover:bg-white/10 text-white font-bold py-3 px-6 rounded-xl transition-colors flex items-center gap-2"
                        >
                            <Edit className="w-4 h-4" />
                            تعديل العنوان
                        </button>

                        <button
                            onClick={() => {
                                if (confirm("هل تريد إلغاء النشر وحذف المسودة؟")) {
                                    setPhase('list');
                                    setCollectedQuestions([]);
                                }
                            }}
                            disabled={isLoading}
                            className="text-red-400 font-bold px-4 hover:bg-red-500/10 rounded-xl transition-colors"
                        >
                            إلغاء
                        </button>

                        <button
                            onClick={publishPoll}
                            disabled={isLoading}
                            className="flex-1 bg-brand-green hover:bg-brand-green/90 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-brand-green/20 disabled:opacity-50"
                        >
                            {isLoading ? 'جاري النشر...' : 'نشر الاستطلاع الآن'}
                            {!isLoading && <Save className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
            )}

            {phase === 'view' && (
                <div className="bg-black/20 border border-white/10 rounded-2xl overflow-hidden p-6 max-w-2xl mx-auto space-y-6 animate-in zoom-in duration-300">
                    <button
                        onClick={() => {
                            setPhase('list');
                            setCollectedQuestions([]);
                            setSelectedPollId(null);
                        }}
                        className="text-white/40 hover:text-white flex items-center gap-2 text-sm transition-colors mb-4"
                    >
                        <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
                        عودة للقائمة
                    </button>

                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/40">
                            <ListChecks className="w-8 h-8 text-blue-500" />
                        </div>
                        <h3 className="text-xl font-bold text-white">تفاصيل الاستطلاع</h3>
                        <p className="text-white/40 mt-1">عرض محتوى الاستطلاع (للقراءة فقط)</p>
                    </div>

                    <div className="bg-black/40 rounded-xl border border-white/10 p-4 space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar">
                        <h4 className="font-bold text-lg text-white border-b border-white/10 pb-2">{pollTitle}</h4>
                        {collectedQuestions.length === 0 ? (
                            <div className="text-center py-8 text-white/30">جارِ التحميل...</div>
                        ) : (
                            collectedQuestions.map((q, i) => (
                                <div key={i} className="bg-white/5 rounded-lg p-3">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-blue-400 font-bold text-sm">سؤال {i + 1}: {q.text}</span>
                                        <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-white/50">
                                            {q.type === 'single' ? 'خيار واحد' : 'عدة خيارات'}
                                        </span>
                                    </div>
                                    <ul className="list-disc list-inside text-xs text-white/60 space-y-1">
                                        {q.options.map((opt, j) => (
                                            <li key={j}>{opt.text}</li>
                                        ))}
                                    </ul>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="flex justify-center pt-4">
                        <div className="text-white/30 text-xs">
                            * هذا الاستطلاع منشور بالفعل ولا يمكن تعديل نصوص الأسئلة للحفاظ على نزاهة البيانات
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
