import { useState, useCallback } from 'react';
import { FileText, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useTheme } from '../../../context/ThemeContext';
import { BranchSelector } from './BranchSelector';
import { usePromotionData } from '../hooks/usePromotionData';
import type { CourseType } from '../types';
import { COURSE_TYPE_LABELS } from '../types';
import { supabase } from '../../../lib/supabase';

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
    const [fileExists, setFileExists] = useState<boolean | null>(null);
    const { getCurriculumUrl, checkFileExists } = usePromotionData();

    // ── جلب المحاضرين ──
    const [lecturers, setLecturers] = useState<{ id: string; full_name: string; job_number: string }[]>([]);
    const [lecturersLoading, setLecturersLoading] = useState(false);

    const fetchLecturers = useCallback(async (type: CourseType) => {
        setLecturersLoading(true);
        try {
            // 1. Fetch profiles who are marked as promotion lecturers (accessible via normal profiles select RLS)
            const { data: dbLecturers, error } = await supabase
                .from('profiles')
                .select('id, full_name, job_number')
                .eq('is_promotion_lecturer', true)
                .order('full_name');

            if (error) throw error;
            if (!dbLecturers || dbLecturers.length === 0) {
                setLecturers([]);
                return;
            }

            // 2. Filter lecturers who actually have a curriculum file uploaded by making parallel lightweight HEAD checks
            const lecturersWithFiles = await Promise.all(
                dbLecturers.map(async (lecturer) => {
                    const path = `curricula/${type}/${lecturer.id}.pdf`;
                    const { data } = supabase.storage.from('Lectures').getPublicUrl(path);
                    if (!data?.publicUrl) return null;
                    try {
                        const res = await fetch(data.publicUrl, { method: 'HEAD' });
                        if (res.status === 200) {
                            return lecturer;
                        }
                    } catch (e) {
                        console.error(`Error verifying curriculum file for lecturer ${lecturer.full_name}:`, e);
                    }
                    return null;
                })
            );

            // Filter out nulls
            setLecturers(lecturersWithFiles.filter((l): l is typeof dbLecturers[number] => l !== null));
        } catch (err) {
            console.error("Error fetching lecturers:", err);
            setLecturers([]);
        } finally {
            setLecturersLoading(false);
        }
    }, []);

    const handleSubjectChange = useCallback(async (lecturerId: string) => {
        setSubject(lecturerId);
        if (!courseType) return;
        setChecking(true);
        setFileExists(null);
        const exists = await checkFileExists('curricula', courseType, lecturerId, 'pdf');
        setFileExists(exists);
        setChecking(false);
    }, [courseType, checkFileExists]);

    const handleCourseTypeChange = useCallback((type: CourseType) => {
        setCourseType(type);
        setSubject(null);
        setFileExists(null);
        fetchLecturers(type);
    }, [fetchLecturers]);

    const openPdf = useCallback(() => {
        if (!courseType || !subject) return;
        const url = getCurriculumUrl(courseType, subject);
        window.open(url, '_blank', 'noopener,noreferrer');
    }, [courseType, subject, getCurriculumUrl]);

    const getLecturerName = (id: string) => {
        return lecturers.find(l => l.id === id)?.full_name || id;
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <BranchSelector
                courseType={courseType}
                subject={subject}
                onCourseTypeChange={handleCourseTypeChange}
                onSubjectChange={handleSubjectChange}
                theme={theme}
                lecturers={lecturers}
                isLoadingLecturers={lecturersLoading}
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
                                لم يتم رفع منهاج لهذا المحاضر بعد
                            </p>
                            <p className={cn("text-xs text-center", isDark ? "text-white/30" : "text-slate-400")}>
                                يرجى التواصل مع المشرف العام أو المحاضر لرفع ملف المنهاج
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
                                    {COURSE_TYPE_LABELS[courseType]} — منهاج الأستاذ: {getLecturerName(subject)}
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
