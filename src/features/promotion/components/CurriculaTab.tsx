import { useState, useCallback } from 'react';
import { FileText, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useTheme } from '../../../context/ThemeContext';
import { BranchSelector } from './BranchSelector';
import { usePromotionData } from '../hooks/usePromotionData';
import type { CourseType, SubjectKey } from '../types';
import { COURSE_TYPE_LABELS, SUBJECT_LABELS } from '../types';

/**
 * تبويب المناهج — واجهة الموظف
 * يعرض خيارات الفرع والمادة ثم يتيح فتح ملف PDF
 */
export const CurriculaTab = () => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const [courseType, setCourseType] = useState<CourseType | null>(null);
    const [subject, setSubject] = useState<SubjectKey | null>(null);
    const [checking, setChecking] = useState(false);
    const [fileExists, setFileExists] = useState<boolean | null>(null);
    const { getCurriculumUrl, checkFileExists } = usePromotionData();

    const handleSubjectChange = useCallback(async (sub: SubjectKey) => {
        setSubject(sub);
        if (!courseType) return;
        setChecking(true);
        setFileExists(null);
        const exists = await checkFileExists('curricula', courseType, sub, 'pdf');
        setFileExists(exists);
        setChecking(false);
    }, [courseType, checkFileExists]);

    const handleCourseTypeChange = useCallback((type: CourseType) => {
        setCourseType(type);
        setSubject(null);
        setFileExists(null);
    }, []);

    const openPdf = useCallback(() => {
        if (!courseType || !subject) return;
        const url = getCurriculumUrl(courseType, subject);
        window.open(url, '_blank', 'noopener,noreferrer');
    }, [courseType, subject, getCurriculumUrl]);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <BranchSelector
                courseType={courseType}
                subject={subject}
                onCourseTypeChange={handleCourseTypeChange}
                onSubjectChange={handleSubjectChange}
                theme={theme}
            />

            {/* عرض زر فتح المنهاج */}
            {courseType && subject && (
                <div className="animate-in fade-in zoom-in-95 duration-300">
                    {checking ? (
                        <div className="flex items-center justify-center gap-2 p-6">
                            <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                            <span className={cn("text-sm", isDark ? "text-white/60" : "text-slate-500")}>
                                جاري التحقق من وجود المنهاج...
                            </span>
                        </div>
                    ) : fileExists === false ? (
                        <div className={cn(
                            "flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed",
                            isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50"
                        )}>
                            <AlertCircle className={cn("w-10 h-10", isDark ? "text-white/20" : "text-slate-300")} />
                            <p className={cn("text-sm font-bold text-center", isDark ? "text-white/50" : "text-slate-400")}>
                                لم يتم رفع منهاج لهذه المادة بعد
                            </p>
                            <p className={cn("text-xs text-center", isDark ? "text-white/30" : "text-slate-400")}>
                                يرجى التواصل مع المشرف العام لرفع ملف المنهاج
                            </p>
                        </div>
                    ) : fileExists === true ? (
                        <div className={cn(
                            "flex flex-col items-center gap-4 p-6 rounded-2xl border",
                            isDark
                                ? "bg-gradient-to-br from-amber-950/30 to-orange-950/20 border-amber-500/20"
                                : "bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200"
                        )}>
                            <div className={cn(
                                "w-16 h-16 rounded-2xl flex items-center justify-center",
                                isDark ? "bg-amber-500/20" : "bg-amber-500/10"
                            )}>
                                <FileText className="w-8 h-8 text-amber-500" />
                            </div>
                            <div className="text-center space-y-1">
                                <p className={cn("font-bold text-sm", isDark ? "text-amber-300" : "text-amber-800")}>
                                    {COURSE_TYPE_LABELS[courseType]} — {SUBJECT_LABELS[courseType][subject]}
                                </p>
                                <p className={cn("text-xs", isDark ? "text-white/50" : "text-slate-500")}>
                                    ملف PDF جاهز للمراجعة والدراسة
                                </p>
                            </div>
                            <button
                                onClick={openPdf}
                                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 active:scale-95"
                            >
                                <ExternalLink className="w-4 h-4" />
                                فتح المنهاج
                            </button>
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
};
