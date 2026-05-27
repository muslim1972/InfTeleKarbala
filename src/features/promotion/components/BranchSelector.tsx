import { BookOpen, Wrench, Loader2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { COURSE_TYPE_LABELS } from '../types';
import type { CourseType } from '../types';

interface BranchSelectorProps {
    courseType: CourseType | null;
    subject: string | null;
    onCourseTypeChange: (type: CourseType) => void;
    onSubjectChange: (subject: string) => void;
    theme: 'light' | 'dark';
    lecturers: { id: string; full_name: string; job_number: string }[];
    isLoadingLecturers?: boolean;
}

/**
 * مكون مشترك لاختيار نوع الدورة والمحاضر
 * يُسخدم في تبويب المناهج وتبويب الاختبار للطلاب
 */
export const BranchSelector = ({
    courseType,
    subject,
    onCourseTypeChange,
    onSubjectChange,
    theme,
    lecturers,
    isLoadingLecturers = false,
}: BranchSelectorProps) => {
    const isDark = theme === 'dark';

    return (
        <div className="space-y-5">
            {/* اختيار نوع الفرع */}
            <div className="space-y-2">
                <label className={cn("text-sm font-bold block", isDark ? "text-white/80" : "text-slate-700")}>
                    نوع الدورة
                </label>
                <div className="grid grid-cols-2 gap-3">
                    {(['administrative', 'technical'] as CourseType[]).map(type => {
                        const isActive = courseType === type;
                        const Icon = type === 'technical' ? Wrench : BookOpen;
                        return (
                            <button
                                key={type}
                                onClick={() => onCourseTypeChange(type)}
                                className={cn(
                                    "flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all duration-300 font-bold text-sm",
                                    isActive
                                        ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 shadow-md shadow-amber-500/10 scale-[1.02]"
                                        : cn(
                                            "border-transparent hover:border-amber-300/50",
                                            isDark ? "bg-white/5 text-white/60 hover:text-white/80" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                        )
                                )}
                            >
                                <Icon className={cn("w-4 h-4", isActive ? "text-amber-500" : "")} />
                                {COURSE_TYPE_LABELS[type]}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* اختيار المحاضر */}
            {courseType && (
                <div className="space-y-2 animate-in fade-in slide-in-from-bottom-3 duration-300">
                    <label className={cn("text-sm font-bold block", isDark ? "text-white/80" : "text-slate-700")}>
                        اختر المحاضر
                    </label>
                    {isLoadingLecturers ? (
                        <div className="flex items-center justify-center p-6">
                            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                        </div>
                    ) : lecturers.length === 0 ? (
                        <p className={cn("text-xs p-4 text-center rounded-xl border-2 border-dashed", isDark ? "text-white/40 border-white/10 bg-white/5" : "text-slate-400 border-slate-200 bg-slate-50")}>
                            لا يوجد محاضرون متاحون حالياً لهذه الدورة
                        </p>
                    ) : (
                        <div className="grid grid-cols-2 gap-2">
                            {lecturers.map((lecturer, idx) => {
                                const isActive = subject === lecturer.id;
                                return (
                                    <button
                                        key={lecturer.id}
                                        onClick={() => onSubjectChange(lecturer.id)}
                                        className={cn(
                                            "flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all duration-300 font-bold text-sm",
                                            isActive
                                                ? "border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 shadow-md shadow-indigo-500/10 scale-[1.02]"
                                                : cn(
                                                    "border-transparent hover:border-indigo-300/50",
                                                    isDark ? "bg-white/5 text-white/60 hover:text-white/80" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                                )
                                        )}
                                    >
                                        <span className={cn(
                                            "w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold shrink-0",
                                            isActive
                                                ? "bg-indigo-500 text-white"
                                                : isDark ? "bg-white/10 text-white/50" : "bg-slate-200 text-slate-500"
                                        )}>
                                            {idx + 1}
                                        </span>
                                        <span className="truncate">{lecturer.full_name}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
