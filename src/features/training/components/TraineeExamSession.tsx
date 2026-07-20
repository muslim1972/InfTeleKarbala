import { useState, useRef } from 'react';
import { CheckCircle, XCircle, Clock, Trophy, ArrowLeft, RotateCcw } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useTheme } from '../../../context/ThemeContext';
import { useTrainingData } from '../hooks/useTrainingData';
import type { MCQQuestion, TrainingStudent } from '../types';
import { MAX_EXAM_ATTEMPTS, calculateGrade, EXAM_GRADE_LABELS } from '../types';

interface TraineeExamSessionProps {
    questions: MCQQuestion[];
    student: TrainingStudent;
    durationMinutes: number;
    currentAttempt: number;
    onFinish: () => void;
    onRetry: () => void;
}

/**
 * جلسة اختبار التدريب الصيفي — مع دعم 5 محاولات وعرض الأجوبة الصحيحة
 */
export const TraineeExamSession = ({
    questions, student, durationMinutes, currentAttempt, onFinish, onRetry
}: TraineeExamSessionProps) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const { saveTrainingResult } = useTrainingData();

    const [answers, setAnswers] = useState<(number | null)[]>(() => new Array(questions.length).fill(null));
    const [submitted, setSubmitted] = useState(false);
    const [score, setScore] = useState(0);
    const [saving, setSaving] = useState(false);

    // Timer
    const totalSeconds = durationMinutes * 60;
    const [remainingSeconds, setRemainingSeconds] = useState(totalSeconds);
    const startedAtRef = useRef(new Date().toISOString());
    const startTimestampRef = useRef(performance.now());
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const topRef = useRef<HTMLDivElement>(null);
    const [exactDuration, setExactDuration] = useState<number | null>(null);

    // Start timer
    useState(() => {
        timerRef.current = setInterval(() => {
            setRemainingSeconds(prev => {
                if (prev <= 1) {
                    if (timerRef.current) clearInterval(timerRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    });

    // Auto-submit when time is up
    if (remainingSeconds === 0 && !submitted) {
        handleSubmit();
    }

    function scrollToTop() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        topRef.current?.scrollIntoView({ behavior: 'smooth' });
    }

    function handleSelectAnswer(questionIdx: number, optionIdx: number) {
        if (submitted) return;
        setAnswers(prev => {
            const next = [...prev];
            next[questionIdx] = optionIdx;
            return next;
        });
    }

    async function handleSubmit() {
        if (submitted) return;
        if (timerRef.current) clearInterval(timerRef.current);

        let correct = 0;
        questions.forEach((q, i) => {
            if (answers[i] === q.correctIndex) correct++;
        });
        
        // احتساب النتيجة: نقطتان لكل إجابة صحيحة
        const finalScore = correct * 2;
        setScore(finalScore);

        setSaving(true);
        const elapsedExactSeconds = (performance.now() - startTimestampRef.current) / 1000;
        setExactDuration(elapsedExactSeconds);

        const success = await saveTrainingResult({
            student_id: student.id,
            score: finalScore,
            total_questions: questions.length, // سيبقى 50 للاحتفاظ بعدد الأسئلة
            attempt_number: currentAttempt,
            started_at: startedAtRef.current,
            duration_seconds: Number(elapsedExactSeconds.toFixed(2)),
            exam_details: { questions, answers }
        });
        setSaving(false);

        if (!success) return;
        setSubmitted(true);
        scrollToTop();
    }

    // Format timer
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    const timerColor = remainingSeconds <= 60 ? 'text-red-500' : remainingSeconds <= 180 ? 'text-amber-500' : 'text-emerald-500';
    const timerProgress = (remainingSeconds / totalSeconds) * 100;

    const remainingAttempts = MAX_EXAM_ATTEMPTS - currentAttempt;

    if (submitted) {
        const isPassed = score >= 70;

        return (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
                <div ref={topRef} className="w-full h-px" />
                {/* Result Card */}
                <div className={cn(
                    "relative rounded-2xl p-6 border text-center space-y-4",
                    isPassed 
                        ? (isDark ? "bg-emerald-950/30 border-emerald-500/20" : "bg-emerald-50 border-emerald-200")
                        : (isDark ? "bg-red-950/30 border-red-500/20" : "bg-red-50 border-red-200")
                )}>
                    {/* Back Button */}
                    <button
                        onClick={onFinish}
                        className={cn(
                            "absolute top-4 left-4 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95",
                            isDark ? "bg-white/10 hover:bg-white/20 text-white" : "bg-white/60 hover:bg-white text-slate-700 border border-slate-200/50"
                        )}
                    >
                        <ArrowLeft className="w-4 h-4" />
                        الرجوع
                    </button>
                    <div className={cn(
                        "w-20 h-20 rounded-full mx-auto flex items-center justify-center",
                        isPassed ? (isDark ? "bg-emerald-500/20" : "bg-emerald-100") : (isDark ? "bg-red-500/20" : "bg-red-100")
                    )}>
                        {isPassed ? (
                            <Trophy className={cn("w-10 h-10", "text-emerald-500")} />
                        ) : (
                            <XCircle className={cn("w-10 h-10", "text-red-500")} />
                        )}
                    </div>
                    
                    <h3 className={cn("text-3xl font-black", isDark ? "text-white" : "text-slate-900")}>
                        <span dir="ltr">{score} / 100</span>
                    </h3>
                    
                    <p className={cn("text-lg font-bold leading-relaxed", isDark ? "text-white/80" : "text-slate-700")}>
                        {isPassed 
                            ? `ألف مبروك يا ${student.full_name}! لقد اجتزت الاختبار بنجاح.` 
                            : `حظاً أوفر يا ${student.full_name}، لم تجتز درجة النجاح المطلوبة (70/100).`}
                    </p>

                    {exactDuration && (
                        <p className={cn("text-sm font-bold", isDark ? "text-amber-300" : "text-amber-700")}>
                            الوقت المستغرق: <span dir="ltr">{Math.floor(exactDuration / 60)}:{(exactDuration % 60).toFixed(2).padStart(5, '0')}</span>
                        </p>
                    )}
                    <p className={cn("text-xs", isDark ? "text-white/50" : "text-slate-500")}>
                        المحاولة رقم {currentAttempt} من {MAX_EXAM_ATTEMPTS}
                    </p>
                    {saving && (
                        <p className={cn("text-xs", isDark ? "text-white/40" : "text-slate-400")}>
                            جاري حفظ النتيجة...
                        </p>
                    )}

                    {/* زر إعادة الاختبار */}
                    {remainingAttempts > 0 ? (
                        <button
                            onClick={onRetry}
                            className="flex items-center justify-center gap-2 mx-auto px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
                        >
                            <RotateCcw className="w-4 h-4" />
                            إعادة الاختبار ({remainingAttempts} محاولات متبقية)
                        </button>
                    ) : (
                        <div className={cn(
                            "flex items-center justify-center gap-2 mx-auto px-6 py-3 rounded-xl font-bold text-sm",
                            isDark ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-red-50 text-red-600 border border-red-200"
                        )}>
                            <XCircle className="w-4 h-4" />
                            نفذت محاولاتك
                        </div>
                    )}
                </div>

                {/* Review Answers - عرض الأجوبة الصحيحة والخاطئة */}
                <div className="space-y-3">
                    <h4 className={cn("text-sm font-bold", isDark ? "text-white/80" : "text-slate-700")}>
                        مراجعة الأجوبة — تعلّم من أخطائك!
                    </h4>
                    {questions.map((q, i) => {
                        const userAnswer = answers[i];
                        const isCorrect = userAnswer === q.correctIndex;
                        return (
                            <div key={i} className={cn(
                                "rounded-xl border p-4",
                                isCorrect
                                    ? isDark ? "border-emerald-500/20 bg-emerald-500/5" : "border-emerald-200 bg-emerald-50/50"
                                    : isDark ? "border-red-500/20 bg-red-500/5" : "border-red-200 bg-red-50/50"
                            )}>
                                <div className="flex items-start gap-2 mb-2">
                                    {isCorrect
                                        ? <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                                        : <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                                    }
                                    <span className={cn("text-sm font-bold", isDark ? "text-white" : "text-slate-800")}>
                                        {i + 1}. {q.question}
                                    </span>
                                </div>
                                <div className="mr-6 space-y-1">
                                    {q.options.map((opt, j) => (
                                        <div key={j} className={cn(
                                            "text-xs px-2 py-1 rounded-lg",
                                            j === q.correctIndex
                                                ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold"
                                                : j === userAnswer && j !== q.correctIndex
                                                    ? "bg-red-500/20 text-red-700 dark:text-red-300 line-through"
                                                    : isDark ? "text-white/50" : "text-slate-500"
                                        )}>
                                            {opt}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-in fade-in duration-300 relative pb-32">
            <div ref={topRef} className="w-full h-px" />
            {/* Timer Bar */}
            <div className={cn(
                "sticky top-0 z-10 rounded-xl p-3 border backdrop-blur-xl",
                isDark ? "bg-slate-900/90 border-white/10" : "bg-white/90 border-slate-200"
            )}>
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <Clock className={cn("w-4 h-4", timerColor)} />
                        <span className={cn("text-lg font-mono font-bold tabular-nums", timerColor)}>
                            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={cn("text-xs", isDark ? "text-white/50" : "text-slate-400")}>
                            المحاولة {currentAttempt} من {MAX_EXAM_ATTEMPTS}
                        </span>
                        <span className={cn("text-xs", isDark ? "text-white/50" : "text-slate-400")}>
                            {answers.filter(a => a !== null).length} / {questions.length} تمت الإجابة
                        </span>
                    </div>
                </div>
                {/* Progress bar */}
                <div className={cn("h-1.5 rounded-full overflow-hidden", isDark ? "bg-white/10" : "bg-slate-200")}>
                    <div
                        className={cn("h-full rounded-full transition-all duration-1000", timerColor.replace('text-', 'bg-'))}
                        style={{ width: `${timerProgress}%` }}
                    />
                </div>
            </div>

            {/* Questions */}
            {questions.map((q, i) => (
                <div
                    key={i}
                    className={cn(
                        "rounded-xl border p-4 transition-all",
                        answers[i] !== null
                            ? isDark ? "border-emerald-500/30 bg-emerald-500/5" : "border-emerald-200 bg-emerald-50/50"
                            : isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"
                    )}
                >
                    <p className={cn("text-sm font-bold mb-3", isDark ? "text-white" : "text-slate-800")}>
                        <span className={cn(
                            "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ml-2",
                            isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-600"
                        )}>
                            {i + 1}
                        </span>
                        {q.question}
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                        {q.options.map((opt, j) => {
                            const isSelected = answers[i] === j;
                            return (
                                <button
                                    key={j}
                                    onClick={() => handleSelectAnswer(i, j)}
                                    className={cn(
                                        "text-right p-3 rounded-lg border transition-all text-sm",
                                        isSelected
                                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold shadow-sm"
                                            : cn(
                                                "hover:border-emerald-300/50",
                                                isDark ? "border-white/5 bg-white/5 text-white/70 hover:bg-white/10" : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                                            )
                                    )}
                                >
                                    <span className={cn(
                                        "inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ml-2",
                                        isSelected
                                            ? "bg-emerald-500 text-white"
                                            : isDark ? "bg-white/10 text-white/40" : "bg-slate-200 text-slate-400"
                                    )}>
                                        {String.fromCharCode(1571 + j)}
                                    </span>
                                    {opt}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}

            {/* Submit Button */}
            <button
                onClick={handleSubmit}
                className="w-full p-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
            >
                إنهاء الاختبار وعرض النتيجة
            </button>
        </div>
    );
};
