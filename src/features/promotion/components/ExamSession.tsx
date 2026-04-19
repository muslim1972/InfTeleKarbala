import { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircle, XCircle, Clock, Trophy, RotateCcw, ArrowLeft } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { usePromotionData } from '../hooks/usePromotionData';
import type { MCQQuestion, CourseType, SubjectKey } from '../types';
import { COURSE_TYPE_LABELS, SUBJECT_LABELS } from '../types';

interface ExamSessionProps {
    questions: MCQQuestion[];
    courseType: CourseType;
    subject: SubjectKey;
    durationMinutes: number;
    onFinish: () => void;
}

/**
 * جلسة الاختبار — عرض الأسئلة مع مؤقت
 */
export const ExamSession = ({ questions, courseType, subject, durationMinutes, onFinish }: ExamSessionProps) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const { user } = useAuth();
    const { saveResult } = usePromotionData();

    const [answers, setAnswers] = useState<(number | null)[]>(() => new Array(questions.length).fill(null));
    const [submitted, setSubmitted] = useState(false);
    const [score, setScore] = useState(0);
    const [saving, setSaving] = useState(false);

    // Timer
    const totalSeconds = durationMinutes * 60;
    const [remainingSeconds, setRemainingSeconds] = useState(totalSeconds);
    const startedAtRef = useRef(new Date().toISOString());
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Start timer
    useEffect(() => {
        timerRef.current = setInterval(() => {
            setRemainingSeconds(prev => {
                if (prev <= 1) {
                    if (timerRef.current) clearInterval(timerRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    // Auto-submit when time is up
    useEffect(() => {
        if (remainingSeconds === 0 && !submitted) {
            handleSubmit();
        }
    }, [remainingSeconds, submitted]);

    const handleSelectAnswer = useCallback((questionIdx: number, optionIdx: number) => {
        if (submitted) return;
        setAnswers(prev => {
            const next = [...prev];
            next[questionIdx] = optionIdx;
            return next;
        });
    }, [submitted]);

    const handleSubmit = useCallback(async () => {
        if (submitted) return;
        if (timerRef.current) clearInterval(timerRef.current);

        // Calculate score
        let correct = 0;
        questions.forEach((q, i) => {
            if (answers[i] === q.correctIndex) correct++;
        });
        setScore(correct);
        setSubmitted(true);

        // Save result
        if (user) {
            setSaving(true);
            const elapsedSeconds = totalSeconds - remainingSeconds;
            await saveResult({
                user_id: user.id,
                user_name: user.full_name,
                job_number: user.job_number || null,
                course_type: courseType,
                subject_name: subject,
                score: correct,
                total_questions: questions.length,
                started_at: startedAtRef.current,
                duration_seconds: elapsedSeconds,
            });
            setSaving(false);
        }
    }, [submitted, questions, answers, user, courseType, subject, totalSeconds, remainingSeconds, saveResult]);

    // Format timer
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    const timerColor = remainingSeconds <= 60 ? 'text-red-500' : remainingSeconds <= 180 ? 'text-amber-500' : 'text-emerald-500';
    const timerProgress = (remainingSeconds / totalSeconds) * 100;

    if (submitted) {
        const percentage = Math.round((score / questions.length) * 100);
        const isPassed = percentage >= 50;

        return (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
                {/* Result Card */}
                <div className={cn(
                    "rounded-2xl p-6 border text-center space-y-4",
                    isPassed
                        ? isDark ? "bg-emerald-950/30 border-emerald-500/20" : "bg-emerald-50 border-emerald-200"
                        : isDark ? "bg-red-950/30 border-red-500/20" : "bg-red-50 border-red-200"
                )}>
                    <div className={cn(
                        "w-20 h-20 rounded-full mx-auto flex items-center justify-center",
                        isPassed
                            ? isDark ? "bg-emerald-500/20" : "bg-emerald-100"
                            : isDark ? "bg-red-500/20" : "bg-red-100"
                    )}>
                        <Trophy className={cn("w-10 h-10", isPassed ? "text-emerald-500" : "text-red-500")} />
                    </div>
                    <h3 className={cn("text-2xl font-bold", isDark ? "text-white" : "text-slate-900")}>
                        {score} / {questions.length}
                    </h3>
                    <p className={cn("text-sm", isDark ? "text-white/60" : "text-slate-500")}>
                        النسبة: {percentage}% — {isPassed ? "ناجح ✓" : "يحتاج إعادة المحاولة"}
                    </p>
                    <p className={cn("text-xs", isDark ? "text-white/40" : "text-slate-400")}>
                        {COURSE_TYPE_LABELS[courseType]} — {SUBJECT_LABELS[courseType][subject]}
                    </p>
                    {saving && (
                        <p className={cn("text-xs", isDark ? "text-white/40" : "text-slate-400")}>
                            جاري حفظ النتيجة...
                        </p>
                    )}
                </div>

                {/* Review Answers */}
                <div className="space-y-3">
                    <h4 className={cn("text-sm font-bold", isDark ? "text-white/80" : "text-slate-700")}>
                        مراجعة الأجوبة
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

                {/* Action Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={onFinish}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border font-bold text-sm transition-all",
                            isDark ? "bg-white/5 border-white/10 text-white/70 hover:bg-white/10" : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
                        )}
                    >
                        <ArrowLeft className="w-4 h-4" />
                        العودة
                    </button>
                    <button
                        onClick={onFinish}
                        className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition-all shadow-lg shadow-amber-500/20 active:scale-95"
                    >
                        <RotateCcw className="w-4 h-4" />
                        اختبار جديد
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
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
                    <span className={cn("text-xs", isDark ? "text-white/50" : "text-slate-400")}>
                        {answers.filter(a => a !== null).length} / {questions.length} تمت الإجابة
                    </span>
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
                            ? isDark ? "border-amber-500/30 bg-amber-500/5" : "border-amber-200 bg-amber-50/50"
                            : isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"
                    )}
                >
                    <p className={cn("text-sm font-bold mb-3", isDark ? "text-white" : "text-slate-800")}>
                        <span className={cn(
                            "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ml-2",
                            isDark ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-600"
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
                                            ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold shadow-sm"
                                            : cn(
                                                "hover:border-amber-300/50",
                                                isDark ? "border-white/5 bg-white/5 text-white/70 hover:bg-white/10" : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                                            )
                                    )}
                                >
                                    <span className={cn(
                                        "inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ml-2",
                                        isSelected
                                            ? "bg-amber-500 text-white"
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
                className="w-full p-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-sm transition-all shadow-lg shadow-amber-500/20 active:scale-[0.98]"
            >
                إنهاء الاختبار وعرض النتيجة
            </button>
        </div>
    );
};
