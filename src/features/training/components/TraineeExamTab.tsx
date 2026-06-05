import { useState, useEffect, useCallback } from 'react';
import { LogOut, Loader2, BookOpen } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useTheme } from '../../../context/ThemeContext';
import { useTrainingData } from '../hooks/useTrainingData';
import type { TrainingStudent, MCQQuestion } from '../types';
import { TraineeExamSession } from './TraineeExamSession';
import { MAX_EXAM_ATTEMPTS } from '../types';

interface TraineeExamTabProps {
    student: TrainingStudent;
    onLogout: () => void;
}

export const TraineeExamTab = ({ student, onLogout }: TraineeExamTabProps) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    
    const { 
        settings, 
        settingsLoading, 
        loadExamQuestions, 
        getStudentAttemptCount 
    } = useTrainingData();

    const [questions, setQuestions] = useState<MCQQuestion[]>([]);
    const [loadingQuestions, setLoadingQuestions] = useState(false);
    const [isExamStarted, setIsExamStarted] = useState(false);
    const [attemptCount, setAttemptCount] = useState<number>(0);
    const [loadingAttempt, setLoadingAttempt] = useState(true);

    const TRAINING_SUBJECT = 'summer_training';

    const loadAttemptData = useCallback(async () => {
        setLoadingAttempt(true);
        const count = await getStudentAttemptCount(student.id);
        setAttemptCount(count);
        setLoadingAttempt(false);
    }, [getStudentAttemptCount, student.id]);

    useEffect(() => {
        loadAttemptData();
    }, [loadAttemptData]);

    const handleStartExam = async () => {
        setLoadingQuestions(true);
        const loadedQuestions = await loadExamQuestions(`${TRAINING_SUBJECT}_A`); // Note: you might want logic to distribute A & B
        setQuestions(loadedQuestions);
        setLoadingQuestions(false);

        if (loadedQuestions.length === 0) {
            alert('لم يتم رفع أسئلة الاختبار بعد. يرجى مراجعة المشرف.');
            return;
        }

        setIsExamStarted(true);
    };

    if (isExamStarted && questions.length > 0 && settings) {
        return (
            <div className="max-w-3xl mx-auto px-4 py-8">
                <TraineeExamSession
                    questions={questions}
                    student={student}
                    durationMinutes={settings.exam_duration_minutes}
                    currentAttempt={attemptCount + 1}
                    onFinish={() => {
                        setIsExamStarted(false);
                        loadAttemptData();
                    }}
                    onRetry={() => {
                        setIsExamStarted(false);
                        loadAttemptData();
                        // Wait a tick before restarting
                        setTimeout(() => handleStartExam(), 100);
                    }}
                />
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto px-4 py-8 animate-in fade-in zoom-in-95 duration-300">
            {/* Header */}
            <div className={cn(
                "rounded-3xl p-6 border mb-6 relative overflow-hidden",
                isDark ? "bg-slate-900 border-emerald-500/20" : "bg-white border-emerald-200 shadow-xl shadow-emerald-500/5"
            )}>
                {/* Background Decor */}
                <div className={cn(
                    "absolute -right-20 -top-20 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none",
                    "bg-gradient-to-br from-emerald-500 to-teal-500"
                )} />

                <div className="relative flex items-center justify-between">
                    <div>
                        <h2 className={cn("text-2xl font-black mb-1", isDark ? "text-white" : "text-slate-900")}>
                            مرحباً، {student.full_name}
                        </h2>
                        <p className={cn("text-sm", isDark ? "text-emerald-400" : "text-emerald-600 font-bold")}>
                            التدريب الصيفي — {student.institution_name}
                        </p>
                    </div>
                    <button
                        onClick={onLogout}
                        className={cn(
                            "p-3 rounded-xl transition-all border shadow-sm",
                            isDark 
                                ? "bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20" 
                                : "bg-red-50 hover:bg-red-100 text-red-600 border-red-200"
                        )}
                        title="تسجيل الخروج"
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className={cn(
                "rounded-3xl p-8 border text-center space-y-6",
                isDark ? "bg-slate-900/50 border-white/10" : "bg-white border-slate-200"
            )}>
                <div className={cn(
                    "w-20 h-20 mx-auto rounded-2xl flex items-center justify-center rotate-3",
                    isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-600"
                )}>
                    <BookOpen className="w-10 h-10 -rotate-3" />
                </div>

                <div className="space-y-2">
                    <h3 className={cn("text-xl font-bold", isDark ? "text-white" : "text-slate-900")}>
                        الاختبار الإلكتروني
                    </h3>
                    <p className={cn("text-sm", isDark ? "text-white/60" : "text-slate-600")}>
                        يجب الإجابة على جميع الأسئلة خلال الوقت المحدد.
                    </p>
                </div>

                {settingsLoading || loadingAttempt ? (
                    <div className="flex justify-center py-4">
                        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                    </div>
                ) : (
                    <div className="space-y-4 pt-4 border-t border-dashed border-emerald-500/20">
                        {/* Status Check */}
                        {!settings?.exam_active ? (
                            <div className={cn(
                                "p-4 rounded-xl border text-sm font-bold",
                                isDark ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : "bg-amber-50 border-amber-200 text-amber-700"
                            )}>
                                الاختبار غير مفعل حالياً. يرجى الانتظار حتى يقوم المشرف بتفعيله.
                            </div>
                        ) : attemptCount >= MAX_EXAM_ATTEMPTS ? (
                            <div className={cn(
                                "p-4 rounded-xl border text-sm font-bold",
                                isDark ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-red-50 border-red-200 text-red-700"
                            )}>
                                لقد استنفذت جميع المحاولات المتاحة ({MAX_EXAM_ATTEMPTS} محاولات).
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className={cn(
                                    "p-4 rounded-xl border text-sm flex justify-between items-center",
                                    isDark ? "bg-emerald-500/5 border-emerald-500/10 text-emerald-300" : "bg-emerald-50 border-emerald-100 text-emerald-800"
                                )}>
                                    <span className="font-bold">المحاولات المتبقية:</span>
                                    <span className="font-mono font-bold text-lg bg-emerald-500 text-white px-3 py-1 rounded-lg">
                                        {MAX_EXAM_ATTEMPTS - attemptCount}
                                    </span>
                                </div>
                                <div className={cn(
                                    "p-4 rounded-xl border text-sm flex justify-between items-center",
                                    isDark ? "bg-white/5 border-white/10 text-white/70" : "bg-slate-50 border-slate-200 text-slate-700"
                                )}>
                                    <span className="font-bold">مدة الاختبار:</span>
                                    <span className="font-bold">
                                        {settings.exam_duration_minutes} دقيقة
                                    </span>
                                </div>

                                <button
                                    onClick={handleStartExam}
                                    disabled={loadingQuestions}
                                    className={cn(
                                        "w-full py-4 rounded-xl font-bold text-lg text-white transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 mt-6",
                                        "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-emerald-500/25"
                                    )}
                                >
                                    {loadingQuestions ? <Loader2 className="w-5 h-5 animate-spin" /> : 'بدء الاختبار الآن'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
