import { useState, useEffect } from "react";
import { useKnowledgeProgress } from "../../../hooks/useKnowledgeProgress";
import type { LessonContent, LessonBlock } from "../../../types/knowledge";
import { Loader2, AlertCircle, Info, CheckCircle, Quote } from "lucide-react";
import { motion } from "framer-motion";
import 'katex/dist/katex.min.css';
import { BlockMath, InlineMath } from 'react-katex';

interface LessonViewerProps {
    fileName: string;
    onBack: () => void;
}

export const LessonViewer = ({ fileName, onBack }: LessonViewerProps) => {
    const { markLessonCompleted, isLessonCompleted } = useKnowledgeProgress();
    const [lessonData, setLessonData] = useState<LessonContent | null>(null);
    const [loading, setLoading] = useState(true);
    const [scrolledToBottom, setScrolledToBottom] = useState(false);

    useEffect(() => {
        const fetchLesson = async () => {
            try {
                const res = await fetch(`/data/knowledge/lessons/${fileName}?v=${Date.now()}`);
                const data: any = await res.json();
                
                // Ensure ID is present regardless of naming (id vs lesson_id)
                const normalizedData: LessonContent = {
                    ...data,
                    id: data.id || data.lesson_id
                };
                
                setLessonData(normalizedData);
                
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

    const renderTextWithMath = (text: string) => {
        if (!text) return "";
        // Split by inline math markers $...$
        const parts = text.split(/(\$.*?\$)/g);
        return parts.map((part, i) => {
            if (part.startsWith('$') && part.endsWith('$')) {
                return <InlineMath key={i} math={part.slice(1, -1)} />;
            }
            return part;
        });
    };

    const renderBlock = (block: LessonBlock, index: number) => {
        const key = block.id || `block-${index}`;
        
        const initial = { opacity: 0, y: 20 };
        const animate = { opacity: 1, y: 0 };
        const transition = { duration: 0.5, delay: index * 0.05 };

        switch (block.type) {
            case 'heading':
                return (
                    <motion.h3 key={key} initial={initial} animate={animate} transition={transition} 
                               className="text-2xl md:text-3xl font-black text-blue-600 dark:text-blue-400 mt-12 mb-6 border-r-4 border-blue-500 pr-4 pb-1 tracking-tight">
                        {renderTextWithMath(block.data)}
                    </motion.h3>
                );

            case 'text':
                return (
                    <motion.p key={key} initial={initial} animate={animate} transition={transition} 
                              className="text-slate-700 dark:text-white/80 leading-relaxed text-lg md:text-xl mb-8 font-medium">
                        {renderTextWithMath(block.data)}
                    </motion.p>
                );

            case 'equation':
            case 'math':
                return (
                    <motion.div key={key} initial={initial} animate={animate} transition={transition} 
                                className="my-10 overflow-x-auto p-8 bg-slate-50 dark:bg-slate-900/60 rounded-3xl border border-slate-200 dark:border-white/10 text-center shadow-inner"
                                dir="ltr">
                        <BlockMath math={block.data} />
                    </motion.div>
                );

            case 'list':
                return (
                    <motion.div key={key} initial={initial} animate={animate} transition={transition} className="mb-10 mr-4">
                        {block.title && <h4 className="text-xl font-bold text-slate-800 dark:text-white mb-4">{renderTextWithMath(block.title)}</h4>}
                        <ul className="space-y-4">
                            {block.items?.map((item, i) => (
                                <li key={i} className="flex items-start gap-3 text-slate-700 dark:text-white/80 text-lg">
                                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-2.5 shrink-0" />
                                    <span>{renderTextWithMath(item)}</span>
                                </li>
                            ))}
                        </ul>
                    </motion.div>
                );

            case 'image':
                return (
                    <motion.figure key={key} initial={initial} animate={animate} transition={transition} 
                                   className="my-10 relative group rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 p-2">
                        <img 
                            src={block.image_url} 
                            alt={block.caption || "Lesson illustration"} 
                            className="w-full h-auto object-contain max-h-[600px] rounded-2xl hover:scale-[1.02] transition-transform duration-700 ease-out" 
                        />
                        {block.caption && (
                            <figcaption className="p-4 text-slate-500 dark:text-white/70 text-sm md:text-base font-bold text-center">
                                {renderTextWithMath(block.caption)}
                            </figcaption>
                        )}
                    </motion.figure>
                );

            case 'note':
                return (
                    <motion.div key={key} initial={initial} animate={animate} transition={transition} 
                                className="bg-amber-50 dark:bg-amber-500/10 border-r-8 border-amber-500 p-8 my-8 rounded-l-[2rem] shadow-lg shadow-amber-500/5">
                        <div className="flex items-center gap-3 mb-3 text-amber-700 dark:text-amber-400">
                            <Info className="w-6 h-6" />
                            <span className="font-black text-lg">ملاحظة تطبيقية</span>
                        </div>
                        <div className="text-slate-800 dark:text-amber-50/90 leading-relaxed text-xl font-bold">
                            {renderTextWithMath(block.data)}
                        </div>
                    </motion.div>
                );

            case 'alert':
                return (
                    <motion.div key={key} initial={initial} animate={animate} transition={transition} 
                                className="flex items-start gap-5 p-6 rounded-2xl border-2 my-8 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-blue-800 dark:text-blue-200">
                        <AlertCircle className="w-7 h-7 shrink-0 mt-0.5" />
                        <div className="text-base md:text-lg leading-relaxed font-bold">{renderTextWithMath(block.data)}</div>
                    </motion.div>
                );

            case 'quote':
                return (
                    <motion.blockquote key={key} initial={initial} animate={animate} transition={transition} 
                                       className="border-r-8 border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 p-8 my-8 rounded-l-[2rem] relative shadow-lg shadow-emerald-500/5 dark:shadow-none">
                        <Quote className="absolute top-6 right-6 w-8 h-8 text-emerald-500/20 dark:text-emerald-500/30 rotate-180" />
                        <div className="text-emerald-800 dark:text-emerald-100 italic pr-10 relative z-10 leading-relaxed text-xl font-bold">
                            {renderTextWithMath(block.data)}
                        </div>
                    </motion.blockquote>
                );

            default:
                return null;
        }
    };

    return (
        <div className="max-w-3xl mx-auto px-4 pb-32 pt-4">
            {/* Header */}
            <header className="mb-14 text-center">
                <h1 className="text-3xl md:text-5xl font-black text-slate-800 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-l dark:from-blue-400 dark:to-emerald-400 mb-4 leading-tight tracking-tight">
                    {renderTextWithMath(lessonData.title)}
                </h1>
                <p className="text-slate-500 dark:text-white/60 text-lg mb-8 max-w-2xl mx-auto font-medium">
                    {renderTextWithMath(lessonData.description)}
                </p>
                <div className="inline-flex items-center gap-3 bg-white dark:bg-slate-800/50 px-6 py-2 rounded-full border border-slate-200 dark:border-white/5 shadow-xl">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                    <span className="text-xs md:text-sm text-emerald-600 dark:text-emerald-400 font-black tracking-widest uppercase">
                        {lessonData.level === 'beginner' ? 'المستوى المبتدئ' : lessonData.level === 'intermediate' ? 'المستوى المتوسط' : 'المستوى المتقدم'}
                    </span>
                </div>
            </header>

            {/* Content Blocks */}
            <article className="max-w-none">
                {lessonData.content_blocks?.map((block, idx) => renderBlock(block, idx))}
                
                {/* Fallback for old structure if still exists */}
                {(lessonData as any).sections?.map((section: any, idx: number) => {
                    const block: any = {
                        type: section.type,
                        data: section.content,
                        caption: section.metadata?.imageCaption,
                        image_url: section.content
                    };
                    return renderBlock(block, idx + (lessonData.content_blocks?.length || 0));
                })}

                {lessonData.footer_summary && (
                    <div className="mt-16 p-8 bg-blue-600 text-white rounded-[2rem] shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
                        <h4 className="text-sm uppercase tracking-widest font-black mb-3 opacity-80">زبدة الدرس :</h4>
                        <p className="text-xl md:text-2xl font-bold leading-relaxed relative z-10">
                            {renderTextWithMath(lessonData.footer_summary)}
                        </p>
                    </div>
                )}
            </article>

            {/* Completion Trigger */}
            <div className="mt-20 pt-10 border-t border-slate-100 dark:border-white/10 flex flex-col items-center">
                {!completed && !scrolledToBottom && (
                    <p className="text-slate-400 dark:text-white/40 text-sm md:text-base font-bold mb-6 animate-pulse">👇 يرجى قراءة الدرس بالكامل لتأكيد الإكمال...</p>
                )}
                
                <button
                    onClick={() => {
                        markLessonCompleted(lessonData.id);
                        setTimeout(onBack, 800); // Give a small delay for the success state to show
                    }}
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
