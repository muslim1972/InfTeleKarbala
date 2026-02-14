import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';
import {
    PieChart, Send, Edit, Loader2, CheckCircle2,
    MessageSquare
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { GlassCard } from '../ui/GlassCard';

interface Option {
    id: string;
    option_text: string;
}

interface Question {
    id: string;
    question_text: string;
    allow_multiple_answers: boolean;
    options: Option[];
}

export interface Poll {
    id: string;
    title: string;
    description: string;
    is_active: boolean;
    questions: Question[];
}

interface PollItemProps {
    poll: Poll;
}

export function PollItem({ poll }: PollItemProps) {
    const { user } = useAuth();
    const [submitting, setSubmitting] = useState(false);
    const [mode, setMode] = useState<'view' | 'edit'>('edit');
    const [answers, setAnswers] = useState<Record<string, string[]>>({});
    const [comment, setComment] = useState('');
    const [wordCount, setWordCount] = useState(0);
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    const MAX_WORDS = 100;

    useEffect(() => {
        if (user?.id) {
            fetchUserResponses();
        }
    }, [user?.id, poll.id]);

    const fetchUserResponses = async () => {
        if (!user?.id) return;

        // جلب الردود والتعليقات بالتوازي (محسّن!)
        const [responsesResult, commentResult] = await Promise.all([
            supabase
                .from('poll_responses')
                .select('question_id, option_id')
                .eq('poll_id', poll.id)
                .eq('user_id', user.id),

            supabase
                .from('poll_comments')
                .select('comment_text, is_anonymous')
                .eq('poll_id', poll.id)
                .eq('user_id', user.id)
                .maybeSingle()
        ]);

        const responses = responsesResult.data;
        const commentData = commentResult.data;

        if (responsesResult.error) {
            console.error('Error fetching responses:', responsesResult.error);
            return;
        }

        if ((responses && responses.length > 0) || commentData) {
            const loadedAnswers: Record<string, string[]> = {};
            responses?.forEach((r: any) => {
                if (!loadedAnswers[r.question_id]) loadedAnswers[r.question_id] = [];
                loadedAnswers[r.question_id].push(r.option_id);
            });

            setAnswers(loadedAnswers);
            const savedComment = commentData?.comment_text || '';
            setComment(savedComment);
            setWordCount(savedComment.trim() === '' ? 0 : savedComment.trim().split(/\s+/).length);
            setIsAnonymous(commentData?.is_anonymous || false);

            setMode('view');
        } else {
            setMode('edit');
        }
    };

    const handleOptionSelect = (questionId: string, optionId: string, isMultiple: boolean) => {
        if (mode === 'view') return;

        setAnswers(prev => {
            const currentSelected = prev[questionId] || [];
            if (isMultiple) {
                if (currentSelected.includes(optionId)) {
                    return { ...prev, [questionId]: currentSelected.filter(id => id !== optionId) };
                } else {
                    return { ...prev, [questionId]: [...currentSelected, optionId] };
                }
            } else {
                return { ...prev, [questionId]: [optionId] };
            }
        });
    };

    const handleCommentChange = (text: string) => {
        const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
        if (words <= MAX_WORDS) {
            setComment(text);
            setWordCount(words);
        } else {
            if (words < wordCount) {
                setComment(text);
                setWordCount(words);
            }
        }
    };

    const handleSubmit = async () => {
        if (!user?.id) return;

        const unanswered = poll.questions.some(q =>
            !answers[q.id] || answers[q.id].length === 0
        );
        if (unanswered) {
            toast.error("يرجى الإجابة على جميع الأسئلة");
            return;
        }

        setSubmitting(true);
        try {
            await supabase.from('poll_responses').delete()
                .eq('poll_id', poll.id).eq('user_id', user.id);

            await supabase.from('poll_comments').delete()
                .eq('poll_id', poll.id).eq('user_id', user.id);

            const responsesToInsert: any[] = [];
            for (const [qId, optionIds] of Object.entries(answers)) {
                for (const optId of optionIds) {
                    responsesToInsert.push({
                        poll_id: poll.id,
                        question_id: qId,
                        option_id: optId,
                        user_id: user.id,
                        is_anonymous: isAnonymous // Ensure this column exists in DB
                    });
                }
            }

            if (responsesToInsert.length > 0) {
                const { error: insertError } = await supabase
                    .from('poll_responses')
                    .insert(responsesToInsert);
                if (insertError) throw insertError;
            }

            if (comment.trim()) {
                const { error: commentError } = await supabase
                    .from('poll_comments')
                    .insert({
                        poll_id: poll.id,
                        user_id: user.id,
                        comment_text: comment,
                        is_anonymous: isAnonymous
                    });
                if (commentError) throw commentError;
            }

            toast.success("تم إرسال إجاباتك بنجاح");
            setMode('view');
            setIsExpanded(false); // Optional: collapse after submit

        } catch (error: any) {
            console.error("Submission error:", error);
            toast.error("حدث خطأ أثناء الإرسال: " + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header Card */}
            <GlassCard
                className="p-6 relative overflow-hidden border-brand-green/20 cursor-pointer hover:bg-white/5 transition-colors group"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-green to-transparent opacity-50" />

                <div className="flex justify-between items-start mb-4">
                    <h2 className="text-2xl font-bold text-foreground max-w-[70%]">{poll.title}</h2>
                    <div className="flex items-center gap-3">
                        {/* Anonymous Toggle - Only in Edit Mode */}
                        {mode !== 'view' && isExpanded && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsAnonymous(!isAnonymous)
                                }}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border",
                                    isAnonymous
                                        ? "bg-zinc-800 text-white border-white/20"
                                        : "bg-brand-green/10 text-brand-green border-brand-green/20"
                                )}
                            >
                                {isAnonymous ? (
                                    <>
                                        <span className="w-2 h-2 rounded-full bg-gray-400" />
                                        هوية مخفية
                                    </>
                                ) : (
                                    <>
                                        <span className="w-2 h-2 rounded-full bg-brand-green animate-pulse" />
                                        هوية ظاهرة
                                    </>
                                )}
                            </button>
                        )}
                        <PieChart className={cn("w-6 h-6 text-muted-foreground transition-transform duration-300", isExpanded && "rotate-180")} />
                    </div>
                </div>

                <div className="flex items-center gap-2 text-brand-green text-sm font-bold bg-brand-green/10 w-fit px-3 py-1 rounded-full">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>استطلاع رسمي</span>
                </div>
            </GlassCard>

            {/* Collapsible Content */}
            {isExpanded && (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300 px-2">
                    {/* Active Status Banner */}
                    {!poll.is_active && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3 animate-pulse">
                            <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_red]" />
                            <p className="text-red-400 font-bold text-sm">
                                هذا الاستطلاع متوقف مؤقتاً ولا يمكن التصويت عليه حالياً
                            </p>
                        </div>
                    )}

                    {/* Questions List */}
                    <div className={cn("space-y-4 transition-opacity", !poll.is_active && "opacity-50 pointer-events-none")}>
                        {poll.questions.map((q, idx) => (
                            <div
                                key={q.id}
                                className="bg-card border border-border rounded-xl p-5 space-y-4"
                                onClickCapture={(e) => {
                                    if (!poll.is_active) {
                                        e.stopPropagation();
                                        toast.error("عذراً، هذا الاستطلاع متوقف حالياً");
                                    }
                                }}
                            >
                                <h3 className="text-lg font-bold text-foreground flex items-start gap-3">
                                    <span className="bg-brand-green/20 text-brand-green w-8 h-8 flex items-center justify-center rounded-lg text-sm font-mono shrink-0 mt-0.5">
                                        {idx + 1}
                                    </span>
                                    {q.question_text}
                                </h3>

                                <div className="grid gap-3 pr-11">
                                    {q.options.map((opt) => {
                                        const isSelected = answers[q.id]?.includes(opt.id);
                                        return (
                                            <button
                                                key={opt.id}
                                                onClick={() => handleOptionSelect(q.id, opt.id, q.allow_multiple_answers)}
                                                disabled={mode === 'view' || !poll.is_active}
                                                className={cn(
                                                    "w-full text-right p-4 rounded-xl border transition-all duration-200 flex items-center justify-between group",
                                                    isSelected
                                                        ? "bg-brand-green text-white border-brand-green shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                                                        : "bg-muted text-foreground border-border hover:bg-muted/80",
                                                    (mode === 'view' || !poll.is_active) && !isSelected && "opacity-50 grayscale"
                                                )}
                                            >
                                                <span className="font-medium">{opt.option_text}</span>
                                                {isSelected && <CheckCircle2 className="w-5 h-5" />}
                                            </button>
                                        );
                                    })}
                                </div>
                                {q.allow_multiple_answers && (
                                    <p className="text-xs text-muted-foreground pr-11">يمكنك اختيار أكثر من إجابة</p>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Personal Opinion Section */}
                    <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                        <label className="text-foreground font-bold flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-brand-yellow" />
                            رأيي الشخصي
                            <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded mr-auto">
                                اختياري
                            </span>
                        </label>
                        <div className="relative">
                            <textarea
                                value={comment}
                                onChange={(e) => handleCommentChange(e.target.value)}
                                disabled={mode === 'view' || !poll.is_active}
                                placeholder="اكتب ملاحظاتك أو مقترحاتك هنا..."
                                className="w-full bg-muted/50 border border-input rounded-xl p-4 text-foreground focus:outline-none focus:border-brand-green/50 min-h-[100px] max-h-[200px] resize-y custom-scrollbar placeholder:text-muted-foreground"
                            />
                            <div className={cn(
                                "absolute bottom-3 left-3 text-xs font-mono px-2 py-1 rounded bg-background/50 border border-border",
                                wordCount >= MAX_WORDS ? "text-red-400" : "text-muted-foreground"
                            )}>
                                {wordCount}/{MAX_WORDS}
                            </div>
                        </div>
                    </div>

                    {/* View/Edit Actions */}
                    <div className={cn(
                        "sticky bottom-24 z-10 transition-all duration-300",
                        mode === 'view' ? "translate-y-0" : "translate-y-0"
                    )}>
                        {mode === 'view' ? (
                            <div className="bg-black/80 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 text-brand-green">
                                    <CheckCircle2 className="w-6 h-6" />
                                    <div>
                                        <p className="font-bold">تم إرسال إجاباتك</p>
                                        <p className="text-xs text-muted-foreground">شكراً لمشاركتك رأيك معنا</p>
                                    </div>
                                </div>

                                {poll.is_active && (
                                    <button
                                        onClick={() => setMode('edit')}
                                        className="bg-muted hover:bg-muted/80 text-foreground px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors border border-border"
                                    >
                                        <span>تعديل الإجابات</span>
                                        <Edit className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        ) : (
                            <button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="w-full bg-brand-green hover:bg-brand-green/90 text-white text-lg font-bold py-4 rounded-2xl shadow-xl shadow-brand-green/20 flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                        <span>جاري الإرسال...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>إرسال الاستطلاع</span>
                                        <Send className="w-5 h-5 rtl:rotate-180" />
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
