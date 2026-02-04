import { useState, useEffect } from 'react';
import {
    PieChart, Save, ArrowLeft, CheckCircle2,
    ListChecks, HelpCircle, MousePointerClick, BarChart3, Plus, Trash2, StopCircle, Edit
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { PollStats } from './PollStats';

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
    // Phases: 'list' -> 'config' -> 'building' -> 'review' | 'stats'
    const [phase, setPhase] = useState<'list' | 'config' | 'building' | 'review' | 'stats'>('list');
    const [isLoading, setIsLoading] = useState(false);
    const [pollsList, setPollsList] = useState<any[]>([]);
    const [selectedPollId, setSelectedPollId] = useState<string | null>(null);

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
    }, [phase]);

    const fetchPolls = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('polls')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) console.error(error);
        else setPollsList(data || []);
        setIsLoading(false);
    };

    // --- Handlers ---

    // Phase 1 -> 2


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
        setPhase('building');
        // Always start at 1, but load existing if we are revisiting
        setCurrentStep(1);
        loadQuestionIntoState(0);
    };

    // ... handleOptionsCountChange ... same

    // ... handleOptionTextChange ... same

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

    // --- Render ---

    if (phase === 'stats' && selectedPollId) {
        return <PollStats pollId={selectedPollId} onBack={() => setPhase('list')} />;
    }

    return (
        <div id="poll-creator-form" className="w-full max-w-4xl mx-auto">

            {phase === 'list' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <ListChecks className="w-6 h-6 text-brand-green" />
                            سجل الاستطلاعات
                        </h2>
                        <button
                            onClick={() => setPhase('config')}
                            className="bg-brand-green hover:bg-brand-green/90 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg hover:shadow-brand-green/20"
                        >
                            <Plus className="w-5 h-5" />
                            استطلاع جديد
                        </button>
                    </div>

                    <div className="grid gap-4">
                        {pollsList.map((p) => (
                            <div key={p.id} className="bg-white/5 border border-white/10 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:bg-white/10 transition-all">
                                <div>
                                    <h3 className="text-white font-bold text-lg mb-1 group-hover:text-brand-green transition-colors">{p.title}</h3>
                                    <div className="flex items-center gap-3 text-sm text-white/40">
                                        <span>{new Date(p.created_at).toLocaleDateString('ar-IQ')}</span>
                                        <span className="w-1 h-1 bg-white/20 rounded-full" />
                                        <span className={cn("px-2 py-0.5 rounded textxs", p.is_active ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400")}>
                                            {p.is_active ? "نشط" : "مغلق"}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => { setSelectedPollId(p.id); setPhase('stats'); }}
                                        className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 p-2 rounded-lg transition-colors tooltip"
                                        title="عرض النتائج"
                                    >
                                        <BarChart3 className="w-5 h-5" />
                                    </button>

                                    {p.is_active && (
                                        <button
                                            // onClick={() => handleDeactivate(p.id)} // Assuming handleDeactivate exists, if not, comment out or add logic
                                            className="bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 p-2 rounded-lg transition-colors opacity-50 cursor-not-allowed"
                                            title="إيقاف (قريباً)"
                                        >
                                            <StopCircle className="w-5 h-5" />
                                        </button>
                                    )}

                                    <button
                                        // onClick={() => handleDelete(p.id)} // Assuming handleDelete exists
                                        className="bg-red-500/10 hover:bg-red-500/20 text-red-500 p-2 rounded-lg transition-colors opacity-50 cursor-not-allowed"
                                        title="حذف (قريباً)"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {pollsList.length === 0 && !isLoading && (
                            <div className="text-center py-10 text-white/30 border border-white/5 rounded-xl border-dashed">
                                لا توجد استطلاعات سابقة
                            </div>
                        )}
                    </div>
                </div>
            )}


            {phase === 'config' && (
                <div className="bg-black/20 border border-white/10 rounded-2xl overflow-hidden p-6 max-w-2xl mx-auto space-y-6 animate-in fade-in zoom-in duration-300">
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
                        <h3 className="text-xl font-bold text-white">إنشاء استطلاع جديد</h3>
                        <p className="text-white/40 mt-2">قم بإعداد هيكل الاستطلاع وتحديد عدد الأسئلة</p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-bold text-white/70 block mb-2">عنوان الاستطلاع</label>
                            <input
                                type="text"
                                value={pollTitle}
                                onChange={e => setPollTitle(e.target.value)}
                                placeholder="مثلاً: استبيان حول جودة الخدمات الإدارية"
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-green/50"
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
                                    className="w-24 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-center text-white font-mono text-xl focus:outline-none focus:border-brand-green/50"
                                />
                                <span className="text-white/40 text-sm">سؤال</span>
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
                <div className="bg-black/20 border border-white/10 rounded-2xl overflow-hidden p-6 max-w-2xl mx-auto space-y-6 animate-in slide-in-from-right duration-300">
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
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-green/50 text-lg"
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
                                    className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors"
                                >
                                    -
                                </button>
                                <div className="flex-1 text-center font-mono text-white text-lg font-bold">
                                    {currentOptionsCount}
                                </div>
                                <button
                                    onClick={() => setCurrentOptionsCount(Math.min(10, currentOptionsCount + 1))}
                                    className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors"
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
                                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-brand-green/30"
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
                <div className="bg-black/20 border border-white/10 rounded-2xl overflow-hidden p-6 max-w-2xl mx-auto space-y-6 animate-in zoom-in duration-300">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-brand-green/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-brand-green/40">
                            <CheckCircle2 className="w-8 h-8 text-brand-green" />
                        </div>
                        <h3 className="text-xl font-bold text-white">مراجعة الاستطلاع</h3>
                        <p className="text-white/40 mt-1">أنت على وشك نشر الاستطلاع التالي</p>
                    </div>

                    <div className="bg-black/40 rounded-xl border border-white/10 p-4 space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                        <h4 className="font-bold text-lg text-white border-b border-white/10 pb-2">{pollTitle}</h4>
                        {collectedQuestions.map((q, i) => (
                            <div key={i} className="bg-white/5 rounded-lg p-3">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-brand-green font-bold text-sm">سؤال {i + 1}: {q.text}</span>
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
                        ))}
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button
                            onClick={() => {
                                setPhase('config');
                                setCurrentStep(1);
                                loadQuestionIntoState(0);
                            }}
                            className="bg-white/5 hover:bg-white/10 text-white font-bold py-3 px-6 rounded-xl transition-colors flex items-center gap-2"
                        >
                            <Edit className="w-4 h-4" />
                            تعديل
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

        </div>
    );
}
