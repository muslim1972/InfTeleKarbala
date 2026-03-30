import { useState, useEffect } from "react";
import { useKnowledgeProgress } from "../../../hooks/useKnowledgeProgress";
import type { TelecomData, LessonMeta } from "../../../types/knowledge";
import { Loader2, BookOpen, Lock, CheckCircle2, ArrowRight } from "lucide-react";
import { LessonViewer } from "./LessonViewer";

export const LessonSeries = () => {
    const { progress, isLessonCompleted, isLessonUnlocked, resetProgress, loading: progressLoading } = useKnowledgeProgress();
    const [lessons, setLessons] = useState<LessonMeta[]>([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [activeLessonFile, setActiveLessonFile] = useState<string | null>(null);

    useEffect(() => {
        const fetchLessons = async () => {
            try {
                const res = await fetch(`/data/knowledge/telecomData.json?v=${Date.now()}`);
                const data: TelecomData = await res.json();
                
                // Get lessons for the current level
                if (progress.currentLevel && data.lessons[progress.currentLevel]) {
                    setLessons(data.lessons[progress.currentLevel]);
                }
            } catch (err) {
                console.error("Failed to load telecom data", err);
            } finally {
                setDataLoading(false);
            }
        };
        fetchLessons();
    }, [progress.currentLevel]);

    if (activeLessonFile) {
        return (
            <div className="w-full">
                <button 
                    onClick={() => setActiveLessonFile(null)}
                    className="flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-6 transition-colors"
                >
                    <ArrowRight className="w-5 h-5 rtl:hidden" />
                    <span className="font-semibold">العودة لسلسلة الدروس</span>
                </button>
                <LessonViewer 
                    fileName={activeLessonFile} 
                    onBack={() => setActiveLessonFile(null)} 
                />
            </div>
        );
    }

    if (progressLoading || dataLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
                <p className="text-slate-400 dark:text-white/60 text-sm animate-pulse font-bold tracking-widest">جاري مزامنة بياناتك التعليمة...</p>
            </div>
        );
    }

    if (!lessons.length) {
        return (
            <div className="text-center p-12 bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-white/5 shadow-xl">
                <p className="text-slate-500 dark:text-white/60 font-bold">لا توجد دروس متاحة لهذا المستوى حالياً.</p>
            </div>
        );
    }

    const levelTitle = progress.currentLevel === 'beginner' ? 'المبتدئ' 
                     : progress.currentLevel === 'intermediate' ? 'المتوسط' 
                     : 'المتقدم';

    return (
        <div className="w-full max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-8 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-blue-500/20 shadow-[0_20px_50px_rgba(0,0,0,0.05)] dark:shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -z-0 group-hover:bg-blue-500/10 transition-all" />
                
                <div className="relative z-10 w-full md:w-auto text-right">
                    <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white mb-2 tracking-tight">المسار التعليمي: {levelTitle}</h2>
                    <p className="text-slate-500 dark:text-white/70 text-sm md:text-base mb-4 font-medium leading-relaxed">استمر في تطوير مهاراتك من خلال إكمال الدروس المتاحة بتسلسل منطقي.</p>
                    <div className="inline-flex items-center gap-3 bg-blue-50 dark:bg-blue-500/10 px-4 py-2 rounded-2xl border border-blue-100 dark:border-blue-500/20 shadow-sm">
                        <span className="text-xs text-blue-600 dark:text-blue-300 font-black uppercase tracking-widest">تقييمك الأخير:</span>
                        <div className="w-px h-3 bg-blue-200 dark:bg-blue-500/30 ml-1" />
                        <span className="text-base text-blue-700 dark:text-blue-400 font-black">{progress.placementScore} / 15</span>
                    </div>
                </div>

                <div className="mt-6 md:mt-0 flex items-center gap-4 relative z-10">
                    <button 
                        onClick={() => {
                            if(window.confirm('هل أنت متأكد من رغبتك في مسح تقدمك وإعادة اختبار تحديد المستوى؟')) {
                                resetProgress();
                            }
                        }}
                        className="text-xs px-5 py-2.5 rounded-2xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 border border-red-100 dark:border-red-500/20 transition-all font-black shadow-sm"
                    >
                        إعادة التقييم
                    </button>
                    <div className="flex items-center gap-3 bg-slate-900 dark:bg-black/30 px-5 py-2.5 rounded-2xl border border-slate-800 dark:border-white/10 shadow-xl">
                        <BookOpen className="w-5 h-5 text-emerald-400 animate-pulse" />
                        <span className="text-white font-black text-sm">
                            مكتمل: {lessons.filter(l => isLessonCompleted(l.id)).length} / {lessons.length}
                        </span>
                    </div>
                </div>
            </div>

            <div className="grid gap-5">
                {lessons.map((lesson, idx) => {
                    const previousLessonId = idx > 0 ? lessons[idx - 1].id : null;
                    const unlocked = isLessonUnlocked(lesson.id, previousLessonId);
                    const completed = isLessonCompleted(lesson.id);

                    return (
                        <div 
                            key={lesson.id}
                            onClick={() => unlocked && setActiveLessonFile(lesson.fileName)}
                            className={`flex flex-col md:flex-row md:items-center justify-between p-6 rounded-[1.5rem] border-2 transition-all duration-500 group relative overflow-hidden ${
                                unlocked 
                                    ? 'bg-white dark:bg-slate-800/80 hover:bg-blue-50/50 dark:hover:bg-slate-700 border-slate-100 dark:border-white/10 cursor-pointer shadow-[0_10px_30px_rgba(0,0,0,0.03)] hover:shadow-xl hover:border-blue-200' 
                                    : 'bg-slate-100/50 dark:bg-slate-900/50 border-slate-200 dark:border-white/5 opacity-60 cursor-not-allowed'
                            }`}
                        >
                            {unlocked && !completed && (
                                <div className="absolute top-0 right-0 w-1 h-full bg-blue-500 transform scale-y-0 group-hover:scale-y-100 transition-transform origin-top duration-500" />
                            )}

                            <div className="flex items-start gap-5 mb-4 md:mb-0 relative z-10">
                                <div className={`w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center border-2 shadow-sm transition-all duration-500 group-hover:scale-110 ${
                                    completed ? 'bg-emerald-500 dark:bg-emerald-500/20 border-emerald-500 text-white dark:text-emerald-400 shadow-emerald-500/20' 
                                    : unlocked ? 'bg-blue-600 dark:bg-blue-500/20 border-blue-600 text-white dark:text-blue-400 shadow-blue-500/20'
                                    : 'bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-400'
                                }`}>
                                    {completed ? <CheckCircle2 className="w-7 h-7" /> : unlocked ? <span className="font-black text-xl">{idx + 1}</span> : <Lock className="w-6 h-6" />}
                                </div>
                                <div>
                                    <h3 className={`text-xl font-black mb-1 transition-colors ${unlocked ? 'text-slate-800 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-400' : 'text-slate-400 dark:text-white/50'}`}>{lesson.title}</h3>
                                    <p className={`text-sm font-medium leading-relaxed line-clamp-2 ${unlocked ? 'text-slate-500 dark:text-white/60' : 'text-slate-300 dark:text-white/30'}`}>{lesson.description}</p>
                                </div>
                            </div>
                            
                            {unlocked && (
                                <div className="md:w-32 text-center md:text-left shrink-0 relative z-10">
                                    <span className={`text-xs px-5 py-2 rounded-xl font-black transition-all duration-300 ${
                                        completed ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/30 shadow-sm' 
                                        : 'bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-500/30 shadow-sm group-hover:bg-blue-600 group-hover:text-white'
                                    }`}>
                                        {completed ? 'اكتمل بنجاح' : 'بدء التعلم'}
                                    </span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
