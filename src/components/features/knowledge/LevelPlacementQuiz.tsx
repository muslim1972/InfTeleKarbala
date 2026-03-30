import { useState, useEffect } from "react";
import { useKnowledgeProgress } from "../../../hooks/useKnowledgeProgress";
import type { QuizQuestion, KnowledgeLevel } from "../../../types/knowledge";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ArrowRight, ArrowLeft } from "lucide-react";

export const LevelPlacementQuiz = () => {
    const { setPlacementResult, progress } = useKnowledgeProgress();
    const quizIndex = progress.lastQuizIndex || 1;
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({}); // Changed to store optionId instead of points
    const [showResult, setShowResult] = useState(false);
    const [finalLevel, setFinalLevel] = useState<KnowledgeLevel>('beginner');
    const [finalScore, setFinalScore] = useState(0);
    const [isSaving, setIsSaving] = useState(false);    
    // Fetch quiz data
    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(`/data/knowledge/quizzes/quiz_${quizIndex}.json?v=${Date.now()}`);
                const data = await res.json();
                setQuestions(data || []);
            } catch (err) {
                console.error("Failed to load quiz data", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [quizIndex]);

    const handleOptionSelect = (questionId: string, optionId: string) => {
        setAnswers(prev => ({
            ...prev,
            [questionId]: optionId
        }));
    };

    const handleNext = () => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        } else {
            finishQuiz();
        }
    };

    const handleBack = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(prev => prev - 1);
        }
    };

    const finishQuiz = () => {
        let totalPoints = 0;
        
        // Calculate total points based on selected option IDs
        questions.forEach(q => {
            const selectedOptionId = answers[q.id];
            const option = q.options.find(o => o.id === selectedOptionId);
            if (option) {
                totalPoints += option.points;
            }
        });

        let level: KnowledgeLevel = 'beginner';
        if (totalPoints > 11) {
            level = 'advanced';
        } else if (totalPoints >= 6) {
            level = 'intermediate';
        }
        
        setFinalScore(totalPoints);
        setFinalLevel(level);
        setShowResult(true);
    };

    const handleConfirmResult = async () => {
        setIsSaving(true);
        try {
            await setPlacementResult(finalLevel, finalScore);
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
                <p className="text-white/60 text-sm animate-pulse">جاري تحميل الاختبار...</p>
            </div>
        );
    }

    if (showResult) {
        return (
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-2xl mx-auto backdrop-blur-xl bg-white/80 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-white/10 p-8 md:p-12 shadow-2xl text-center relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -z-10 animate-pulse pointer-events-none" />
                
                <div className="mb-8">
                    <div className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/20">
                        <span className="text-3xl font-bold text-white">{finalScore}</span>
                    </div>
                    <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white mb-2">اكتمل التقييم بنجاح!</h2>
                    <p className="text-slate-600 dark:text-white/60">لقد حصلت على {finalScore} من أصل {questions.length} نقطة.</p>
                </div>

                <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-6 mb-10 border border-slate-100 dark:border-white/10">
                    <p className="text-sm text-slate-500 dark:text-white/40 mb-2 uppercase tracking-widest font-bold">المسار التعليمي المقترح</p>
                    <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
                        {finalLevel === 'beginner' ? 'المستوى المبتدئ' : finalLevel === 'intermediate' ? 'المستوى المتوسط' : 'المستوى المتقدم'}
                    </div>
                </div>

                <button
                    onClick={handleConfirmResult}
                    disabled={isSaving}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-4 px-8 rounded-2xl shadow-xl shadow-blue-500/20 transform transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                    {isSaving ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>جاري التسجيل...</span>
                        </>
                    ) : (
                        <>
                            <span>بدء رحلة التعلم</span>
                            <ArrowLeft className="w-6 h-6" />
                        </>
                    )}
                </button>
            </motion.div>
        );
    }

    const currentQuestion = questions[currentQuestionIndex];
    const hasAnsweredCurrent = answers[currentQuestion.id] !== undefined;
    const progressPercent = ((currentQuestionIndex + 1) / questions.length) * 100;

    const getModelLabel = () => {
        switch(quizIndex) {
            case 1: return 'أ';
            case 2: return 'ب';
            case 3: return 'ج';
            case 4: return 'د';
            default: return quizIndex.toString();
        }
    };
    return (
        <div className="w-full max-w-2xl mx-auto backdrop-blur-2xl bg-white dark:bg-slate-900/60 rounded-[2.5rem] border border-slate-200 dark:border-white/10 p-8 md:p-12 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] dark:shadow-2xl relative overflow-hidden transition-colors duration-500">
            {/* Ambient Background */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-[100px] -z-10 animate-pulse pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-[100px] -z-10 animate-pulse pointer-events-none" />
            
            {/* Header info */}
            <div className="text-center mb-8 relative z-10">
                <div className="inline-flex items-center gap-2 bg-blue-500/10 dark:bg-blue-500/20 px-4 py-1.5 rounded-full border border-blue-500/20 dark:border-blue-400/30 mb-4 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                    <span className="text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-tight">
                        نموذج الاختبار ({getModelLabel()})
                    </span>
                </div>
                <h2 className="text-2xl md:text-4xl font-black text-slate-800 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-l dark:from-blue-400 dark:to-emerald-400 mb-2 drop-shadow-sm">اختبار تحديد المستوى</h2>
                <p className="text-slate-500 dark:text-white/60 text-sm md:text-base leading-relaxed max-w-md mx-auto font-medium">لضمان تقديم المحتوى المناسب لخبرتك، يرجى الإجابة بدقة.</p>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mb-8 overflow-hidden relative z-10">
                <motion.div 
                    className="h-full bg-gradient-to-l from-blue-500 to-emerald-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.6)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                />
            </div>

            {/* Question Container - using AnimatePresence for smooth slide/fade */}
            <div className="min-h-[250px] relative z-10">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentQuestion.id}
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        transition={{ duration: 0.3 }}
                    >
                        <h3 className="text-xl font-semibold text-slate-800 dark:text-white/90 mb-6 leading-relaxed">
                            <span className="text-blue-500 dark:text-blue-400 text-sm ml-2 font-mono">{currentQuestionIndex + 1}/{questions.length}</span>
                            {currentQuestion.text}
                        </h3>

                        <div className="flex flex-col gap-4">
                            {currentQuestion.options.map((opt) => {
                                const isSelected = answers[currentQuestion.id] === opt.id;
                                return (
                                    <button
                                        key={opt.id}
                                        onClick={() => handleOptionSelect(currentQuestion.id, opt.id)}
                                        className={`w-full text-right p-5 rounded-2xl border-2 transition-all duration-300 flex items-center gap-4 group ${
                                            isSelected
                                                ? 'bg-blue-600 dark:bg-blue-500/20 border-blue-600 dark:border-blue-400/50 shadow-xl shadow-blue-500/20 text-white dark:text-white'
                                                : 'bg-white dark:bg-white/5 border-slate-100 dark:border-white/10 text-slate-600 dark:text-white/70 hover:border-blue-200 dark:hover:border-white/20 hover:bg-blue-50/50 dark:hover:bg-white/10'
                                        }`}
                                    >
                                        <div className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all duration-300 ${
                                            isSelected ? 'border-white dark:border-blue-400 bg-white dark:bg-transparent' : 'border-slate-300 dark:border-white/30 group-hover:border-blue-400'
                                        }`}>
                                            {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-blue-600 dark:bg-blue-400" />}
                                        </div>
                                        <span className={`text-base md:text-lg leading-relaxed font-bold transition-colors ${isSelected ? 'text-white' : 'text-slate-700 dark:text-white/80'}`}>{opt.text}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Controls */}
            <div className="flex justify-between items-center mt-10 relative z-10">
                <button
                    onClick={handleBack}
                    disabled={currentQuestionIndex === 0}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all ${
                        currentQuestionIndex === 0 
                        ? 'opacity-0 pointer-events-none' 
                        : 'text-slate-500 dark:text-white/60 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
                    }`}
                >
                    <ArrowRight className="w-5 h-5 rtl:hidden" />
                    <span>السابق</span>
                </button>

                <button
                    onClick={handleNext}
                    disabled={!hasAnsweredCurrent}
                    className={`flex items-center gap-2 px-8 py-2.5 rounded-xl font-bold transition-all shadow-lg text-white ${
                        hasAnsweredCurrent 
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:scale-105 hover:shadow-blue-500/25 active:scale-95' 
                        : 'bg-slate-300 dark:bg-slate-800 text-slate-500 dark:text-white/30 cursor-not-allowed shadow-none'
                    }`}
                >
                    <span>{currentQuestionIndex === questions.length - 1 ? 'إنهاء الاختبار' : 'التالي'}</span>
                    <ArrowLeft className="w-5 h-5 rtl:hidden" />
                </button>
            </div>
        </div>
    );
};
