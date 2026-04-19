import { useState } from 'react';
import { Loader2, AlertCircle, Play, Lock } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useTheme } from '../../../context/ThemeContext';
import { BranchSelector } from './BranchSelector';
import { ExamSession } from './ExamSession';
import { usePromotionData } from '../hooks/usePromotionData';
import type { CourseType, SubjectKey, MCQQuestion } from '../types';

/**
 * تبويب الاختبار — واجهة الموظف
 * اختيار فرع ومادة ← فحص تفعيل الاختبار ← بدء الاختبار
 */
export const ExamTab = () => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const { settings, settingsLoading, loadExamQuestions, checkFileExists } = usePromotionData();

    const [courseType, setCourseType] = useState<CourseType | null>(null);
    const [subject, setSubject] = useState<SubjectKey | null>(null);
    const [loadingQuestions, setLoadingQuestions] = useState(false);
    const [checking, setChecking] = useState(false);
    const [fileExists, setFileExists] = useState<boolean | null>(null);
    const [questions, setQuestions] = useState<MCQQuestion[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleCourseTypeChange = (type: CourseType) => {
        setCourseType(type);
        setSubject(null);
        setFileExists(null);
        setQuestions(null);
        setError(null);
    };

    const handleSubjectChange = async (sub: SubjectKey) => {
        setSubject(sub);
        setQuestions(null);
        setError(null);
        if (!courseType) return;
        setChecking(true);
        const exists = await checkFileExists('exams', courseType, sub, 'xlsx');
        setFileExists(exists);
        setChecking(false);
    };

    const handleStartExam = async () => {
        if (!courseType || !subject) return;
        setLoadingQuestions(true);
        setError(null);
        try {
            const loaded = await loadExamQuestions(courseType, subject, 10);
            if (loaded.length === 0) {
                setError('لم يتم العثور على أسئلة في الملف. يرجى التأكد من صحة صيغة ملف Excel.');
                return;
            }
            setQuestions(loaded);
        } catch {
            setError('حدث خطأ أثناء تحميل الأسئلة');
        } finally {
            setLoadingQuestions(false);
        }
    };

    const handleFinishExam = () => {
        setQuestions(null);
        setSubject(null);
        setFileExists(null);
    };

    // If exam session is active, show it
    if (questions && courseType && subject && settings) {
        return (
            <ExamSession
                questions={questions}
                courseType={courseType}
                subject={subject}
                durationMinutes={settings.exam_duration_minutes}
                onFinish={handleFinishExam}
            />
        );
    }

    const isExamActive = settings?.exam_active === true;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <BranchSelector
                courseType={courseType}
                subject={subject}
                onCourseTypeChange={handleCourseTypeChange}
                onSubjectChange={handleSubjectChange}
                theme={theme}
            />

            {/* حالة الاختبار */}
            {courseType && subject && (
                <div className="animate-in fade-in zoom-in-95 duration-300">
                    {settingsLoading || checking ? (
                        <div className="flex items-center justify-center gap-2 p-6">
                            <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                            <span className={cn("text-sm", isDark ? "text-white/60" : "text-slate-500")}>
                                جاري التحقق...
                            </span>
                        </div>
                    ) : !isExamActive ? (
                        <div className={cn(
                            "flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed",
                            isDark ? "border-red-500/20 bg-red-500/5" : "border-red-200 bg-red-50"
                        )}>
                            <Lock className={cn("w-10 h-10", isDark ? "text-red-400/50" : "text-red-300")} />
                            <p className={cn("text-sm font-bold text-center", isDark ? "text-red-400" : "text-red-600")}>
                                الاختبار غير متاح حالياً
                            </p>
                            <p className={cn("text-xs text-center", isDark ? "text-white/40" : "text-slate-400")}>
                                سيتم الإعلان عن موعد فتح الاختبار من قبل المشرف العام
                            </p>
                        </div>
                    ) : fileExists === false ? (
                        <div className={cn(
                            "flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed",
                            isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50"
                        )}>
                            <AlertCircle className={cn("w-10 h-10", isDark ? "text-white/20" : "text-slate-300")} />
                            <p className={cn("text-sm font-bold text-center", isDark ? "text-white/50" : "text-slate-400")}>
                                لم يتم رفع أسئلة لهذه المادة بعد
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {error && (
                                <div className={cn(
                                    "p-3 rounded-xl border text-sm text-center",
                                    isDark ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-red-50 border-red-200 text-red-600"
                                )}>
                                    {error}
                                </div>
                            )}

                            <div className={cn(
                                "flex flex-col items-center gap-4 p-6 rounded-2xl border",
                                isDark
                                    ? "bg-gradient-to-br from-indigo-950/30 to-purple-950/20 border-indigo-500/20"
                                    : "bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200"
                            )}>
                                <div className={cn(
                                    "w-16 h-16 rounded-2xl flex items-center justify-center",
                                    isDark ? "bg-indigo-500/20" : "bg-indigo-500/10"
                                )}>
                                    <Play className="w-8 h-8 text-indigo-500" />
                                </div>
                                <div className="text-center space-y-1">
                                    <p className={cn("font-bold text-sm", isDark ? "text-indigo-300" : "text-indigo-800")}>
                                        الاختبار جاهز
                                    </p>
                                    <p className={cn("text-xs", isDark ? "text-white/50" : "text-slate-500")}>
                                        {settings?.exam_duration_minutes || 10} دقائق — 10 أسئلة عشوائية
                                    </p>
                                </div>
                                <button
                                    onClick={handleStartExam}
                                    disabled={loadingQuestions}
                                    className="flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold text-sm transition-all shadow-lg shadow-indigo-500/20 active:scale-95 disabled:opacity-50"
                                >
                                    {loadingQuestions ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Play className="w-4 h-4" />
                                    )}
                                    ابدأ الاختبار
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
