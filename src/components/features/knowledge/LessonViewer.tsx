import { useState, useEffect } from "react";
import { useKnowledgeProgress } from "../../../hooks/useKnowledgeProgress";
import type { LessonContent, LessonSection } from "../../../types/knowledge";
import { Loader2, AlertCircle, Info, CheckCircle, Quote } from "lucide-react";
import { motion } from "framer-motion";
import 'katex/dist/katex.min.css';
import { BlockMath } from 'react-katex';

interface LessonViewerProps {
    fileName: string;
}

export const LessonViewer = ({ fileName }: LessonViewerProps) => {
    const { markLessonCompleted, isLessonCompleted } = useKnowledgeProgress();
    const [lessonData, setLessonData] = useState<LessonContent | null>(null);
    const [loading, setLoading] = useState(true);
    const [scrolledToBottom, setScrolledToBottom] = useState(false);

    useEffect(() => {
        const fetchLesson = async () => {
            try {
                const res = await fetch(`/data/knowledge/lessons/${fileName}?v=${Date.now()}`);
                const data: LessonContent = await res.json();
                setLessonData(data);
                
                // If it's short, allow completion immediately
                if (window.innerHeight > document.body.scrollHeight) {
                    setScrolledToBottom(true);
                }
            } catch (err) {
                console.error("Failed to load lesson content", err);
            } finally {
                setLoading(false);
            }
        };

        setLoading(true);
        fetchLesson();
    }, [fileName]);

    // Handle scroll to unlock "Complete Lesson"
    useEffect(() => {
        const handleScroll = () => {
            const scrollPosition = window.innerHeight + window.scrollY;
            const threshold = document.documentElement.scrollHeight - 100;
            if (scrollPosition >= threshold) {
                setScrolledToBottom(true);
            }
        };

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (!lessonData) {
        return <div className="text-white/50 text-center p-12">فشل تحميل محتوى الدرس.</div>;
    }

    const completed = isLessonCompleted(lessonData.id);

    const renderSection = (section: LessonSection, index: number) => {
        const key = section.id || index;
        
        // Simple sequential animation
        const initial = { opacity: 0, y: 20 };
        const animate = { opacity: 1, y: 0 };
        const transition = { duration: 0.5, delay: index * 0.1 };

        switch (section.type) {
            case 'title':
                return (
                    <motion.h3 key={key} initial={initial} animate={animate} transition={transition} 
                               className="text-2xl md:text-3xl font-black text-blue-600 dark:text-blue-400 mt-12 mb-6 border-b-2 border-blue-500/10 dark:border-blue-500/20 pb-3 tracking-tight">
                        {section.content}
                    </motion.h3>
                );

            case 'text':
                return (
                    <motion.p key={key} initial={initial} animate={animate} transition={transition} 
                              className="text-slate-700 dark:text-white/80 leading-relaxed text-lg md:text-xl mb-8 font-medium">
                        {section.content}
                    </motion.p>
                );

            case 'image':
                return (
                    <motion.figure key={key} initial={initial} animate={animate} transition={transition} 
                                   className="my-10 relative group rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20">
                        <img 
                            src={section.content} 
                            alt={section.metadata?.imageCaption || "Lesson illustration"} 
                            className="w-full h-auto object-contain max-h-[500px] hover:scale-[1.03] transition-transform duration-700 ease-out" 
                        />
                        {section.metadata?.imageCaption && (
                            <figcaption className="p-4 bg-white/90 dark:bg-slate-900/80 backdrop-blur-md text-slate-500 dark:text-white/70 text-sm md:text-base font-bold text-center border-t border-slate-100 dark:border-white/10">
                                {section.metadata.imageCaption}
                            </figcaption>
                        )}
                    </motion.figure>
                );

            case 'quote':
                return (
                    <motion.blockquote key={key} initial={initial} animate={animate} transition={transition} 
                                       className="border-r-8 border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 p-8 my-8 rounded-l-[2rem] relative shadow-lg shadow-emerald-500/5 dark:shadow-none">
                        <Quote className="absolute top-6 right-6 w-8 h-8 text-emerald-500/20 dark:text-emerald-500/30 rotate-180" />
                        <p className="text-emerald-800 dark:text-emerald-100 italic pr-10 relative z-10 leading-relaxed text-xl font-bold">
                            {section.content}
                        </p>
                    </motion.blockquote>
                );

            case 'alert':
                const isWarning = section.metadata?.alertType === 'warning';
                const isSuccess = section.metadata?.alertType === 'success';
                return (
                    <motion.div key={key} initial={initial} animate={animate} transition={transition} 
                                className={`flex items-start gap-5 p-6 rounded-2xl border-2 my-8 shadow-sm ${
                                    isWarning ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/30 text-orange-800 dark:text-orange-200' :
                                    isSuccess ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-200' :
                                    'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-blue-800 dark:text-blue-200'
                                }`}>
                        {isWarning ? <AlertCircle className="w-7 h-7 shrink-0 mt-0.5" /> : 
                         isSuccess ? <CheckCircle className="w-7 h-7 shrink-0 mt-0.5" /> : 
                         <Info className="w-7 h-7 shrink-0 mt-0.5" />}
                        <p className="text-base md:text-lg leading-relaxed font-bold">{section.content}</p>
                    </motion.div>
                );

            case 'math':
                return (
                    <motion.div key={key} initial={initial} animate={animate} transition={transition} 
                                className="my-10 overflow-x-auto p-8 bg-slate-50 dark:bg-slate-900/60 rounded-3xl border border-slate-200 dark:border-white/10 text-center shadow-inner"
                                dir="ltr">
                        <BlockMath math={section.content} />
                    </motion.div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="max-w-3xl mx-auto px-4 pb-32 pt-4">
            {/* Header */}
            <header className="mb-14 text-center">
                <h1 className="text-3xl md:text-5xl font-black text-slate-800 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-l dark:from-blue-400 dark:to-emerald-400 mb-6 leading-tight tracking-tight uppercase">
                    {lessonData.title}
                </h1>
                <div className="inline-flex items-center gap-3 bg-white dark:bg-slate-800/50 px-6 py-2 rounded-full border border-slate-200 dark:border-white/5 shadow-xl">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                    <span className="text-xs md:text-sm text-emerald-600 dark:text-emerald-400 font-black tracking-widest uppercase">
                        {lessonData.level === 'beginner' ? 'المستوى المبتدئ' : lessonData.level === 'intermediate' ? 'المستوى المتوسط' : 'المستوى المتقدم'}
                    </span>
                </div>
            </header>

            {/* Content Blocks */}
            <article className="max-w-none">
                {lessonData.sections.map((section, idx) => renderSection(section, idx))}
            </article>

            {/* Completion Trigger */}
            <div className="mt-20 pt-10 border-t border-slate-100 dark:border-white/10 flex flex-col items-center">
                {!completed && !scrolledToBottom && (
                    <p className="text-slate-400 dark:text-white/40 text-sm md:text-base font-bold mb-6 animate-pulse">👇 يرجى قراءة الدرس بالكامل لتأكيد الإكمال...</p>
                )}
                
                <button
                    onClick={() => markLessonCompleted(lessonData.id)}
                    disabled={completed || !scrolledToBottom}
                    className={`flex items-center gap-4 px-10 py-5 rounded-[2rem] font-black text-lg md:text-xl transition-all duration-500 shadow-2xl ${
                        completed 
                            ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-2 border-emerald-500/20 cursor-default opacity-80'
                            : scrolledToBottom
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white hover:scale-105 active:scale-95 shadow-blue-500/25 ring-4 ring-blue-500/10'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-white/30 cursor-not-allowed border-2 border-slate-100 dark:border-white/5'
                    }`}
                >
                    {completed && <CheckCircle className="w-7 h-7" />}
                    <span>{completed ? 'اكتمل هذا الدرس بنجاح ✓' : 'تأكيد إكمال الدرس والمواصلة'}</span>
                </button>
            </div>
        </div>
    );
};
