import { BookOpen, Wrench } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { COURSE_TYPE_LABELS, SUBJECT_LABELS } from '../types';
import type { CourseType, SubjectKey } from '../types';

interface BranchSelectorProps {
    courseType: CourseType | null;
    subject: SubjectKey | null;
    onCourseTypeChange: (type: CourseType) => void;
    onSubjectChange: (subject: SubjectKey) => void;
    theme: 'light' | 'dark';
}

/**
 * مكون مشترك لاختيار نوع الدورة والمادة
 * يُستخدم في تبويب المناهج وتبويب الاختبار
 */
export const BranchSelector = ({
    courseType,
    subject,
    onCourseTypeChange,
    onSubjectChange,
    theme,
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

            {/* اختيار المادة */}
            {courseType && (
                <div className="space-y-2 animate-in fade-in slide-in-from-bottom-3 duration-300">
                    <label className={cn("text-sm font-bold block", isDark ? "text-white/80" : "text-slate-700")}>
                        اختر المادة
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(SUBJECT_LABELS[courseType]) as SubjectKey[]).map((key, idx) => {
                            const isActive = subject === key;
                            return (
                                <button
                                    key={key}
                                    onClick={() => onSubjectChange(key)}
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
                                        "w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold",
                                        isActive
                                            ? "bg-indigo-500 text-white"
                                            : isDark ? "bg-white/10 text-white/50" : "bg-slate-200 text-slate-500"
                                    )}>
                                        {idx + 1}
                                    </span>
                                    {SUBJECT_LABELS[courseType][key]}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
