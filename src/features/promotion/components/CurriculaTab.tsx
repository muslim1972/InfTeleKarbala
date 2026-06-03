import { useState, useCallback } from 'react';
import { FileText, Loader2, AlertCircle, ArrowLeft, Eye } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useTheme } from '../../../context/ThemeContext';
import { BranchSelector } from './BranchSelector';
import { usePromotionData } from '../hooks/usePromotionData';
import type { CourseType } from '../types';


/**
 * تبويب المناهج — واجهة الموظف
 * يعرض خيارات الفرع والمحاضر ثم يتيح فتح ملف PDF الخاص بالمحاضر
 */
export const CurriculaTab = () => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const [courseType, setCourseType] = useState<CourseType | null>(null);
    const [subject, setSubject] = useState<string | null>(null); // يخزن معرف المحاضر
    const [checking, setChecking] = useState(false);
    const [files, setFiles] = useState<any[]>([]);
    const [viewingPdfUrl, setViewingPdfUrl] = useState<string | null>(null);
    const { getCurriculumFileUrl, listCurriculaFiles } = usePromotionData();

    const handleSubjectChange = useCallback(async (dateString: string) => {
        setSubject(dateString);
        if (!courseType) return;
        setChecking(true);
        setFiles([]);
        const listedFiles = await listCurriculaFiles(courseType, dateString);
        setFiles(listedFiles);
        setChecking(false);
    }, [courseType, listCurriculaFiles]);

    const handleCourseTypeChange = useCallback((type: CourseType) => {
        setCourseType(type);
        setSubject(null);
        setFiles([]);
    }, []);

    const openPdf = useCallback((filename: string) => {
        if (!courseType || !subject) return;
        const url = getCurriculumFileUrl(courseType, subject, filename);
        setViewingPdfUrl(url);
    }, [courseType, subject, getCurriculumFileUrl]);

    if (viewingPdfUrl) {
        return (
            <div className="fixed inset-0 z-50 flex flex-col bg-slate-900 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center p-4 bg-slate-900 border-b border-white/10 shrink-0">
                    <button
                        onClick={() => setViewingPdfUrl(null)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-sm transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        الرجوع
                    </button>
                    <div className="flex-1 text-center font-bold text-white pr-8">
                        عارض المنهاج
                    </div>
                </div>
                <div className="flex-1 w-full bg-white relative">
                    <iframe
                        src={viewingPdfUrl}
                        className="absolute inset-0 w-full h-full border-0"
                        title="PDF Viewer"
                    />
                </div>
            </div>
        );
    }


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
                    ) : files.length === 0 ? (
                        <div className={cn(
                            "flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed",
                            isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50"
                        )}>
                            <AlertCircle className={cn("w-10 h-10", isDark ? "text-white/20" : "text-slate-300")} />
                            <p className={cn("text-sm font-bold text-center", isDark ? "text-white/50" : "text-slate-400")}>
                                لم يتم رفع مناهج لدورة هذا التأريخ
                            </p>
                            <p className={cn("text-xs text-center", isDark ? "text-white/30" : "text-slate-400")}>
                                يرجى التواصل مع المشرف العام أو المشرف لرفع ملف المنهاج
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <h3 className={cn("text-lg font-bold text-center mb-4", isDark ? "text-white" : "text-slate-800")}>
                                المناهج المتاحة للدراسة ({files.length} ملفات)
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {files.map((file, idx) => (
                                    <div key={idx} className={cn(
                                        "flex flex-col items-center gap-4 p-6 rounded-2xl border",
                                        isDark
                                            ? "bg-gradient-to-br from-amber-950/30 to-orange-950/20 border-amber-500/20"
                                            : "bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200"
                                    )}>
                                        <div className={cn(
                                            "w-12 h-12 rounded-xl flex items-center justify-center",
                                            isDark ? "bg-amber-500/20" : "bg-amber-500/10"
                                        )}>
                                            <FileText className="w-6 h-6 text-amber-500" />
                                        </div>
                                        <div className="text-center space-y-1 w-full">
                                            <p className={cn("font-bold text-sm truncate w-full", isDark ? "text-amber-300" : "text-amber-800")} title={file.name}>
                                                {file.name}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => openPdf(file.name)}
                                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 active:scale-95"
                                        >
                                            <Eye className="w-4 h-4" />
                                            فتح المنهاج
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
