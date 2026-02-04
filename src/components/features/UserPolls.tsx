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

interface Poll {
    id: string;
    title: string;
    description: string;
    questions: Question[];
}

export function UserPolls() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [activePoll, setActivePoll] = useState<Poll | null>(null);
    const [mode, setMode] = useState<'view' | 'edit' | 'empty'>('empty');

    // State for answers: question_id -> array of selected option_ids
    const [answers, setAnswers] = useState<Record<string, string[]>>({});

    // State for comment
    const [comment, setComment] = useState('');
    const [wordCount, setWordCount] = useState(0);
    const [isAnonymous, setIsAnonymous] = useState(false);

    const MAX_WORDS = 100;

    useEffect(() => {
        if (user?.id) {
            fetchLatestPoll();
        }
    }, [user?.id]);

    const fetchLatestPoll = async () => {
        setLoading(true);
        try {
            // 1. Get latest active poll
            const { data: pollData, error: pollError } = await supabase
                .from('polls')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (pollError) throw pollError;

            if (!pollData) {
                setMode('empty');
                setLoading(false);
                return;
            }

            // 2. Fetch Questions & Options
            const { data: questionsData, error: qError } = await supabase
                .from('poll_questions')
                .select('id, question_text, allow_multiple_answers, order_index, poll_options(id, option_text, order_index)')
                .eq('poll_id', pollData.id)
                .order('order_index');

            if (qError) throw qError;

            // Sort options for each question
            const formattedQuestions = questionsData.map((q: any) => ({
                ...q,
                options: q.poll_options.sort((a: any, b: any) => a.order_index - b.order_index)
            }));

            setActivePoll({
                id: pollData.id,
                title: pollData.title,
                description: pollData.description,
                questions: formattedQuestions
            });

            // 3. Check for existing responses
            await fetchUserResponses(pollData.id);

        } catch (error) {
            console.error("Error fetching poll:", error);
            toast.error("حدث خطأ أثناء تحميل الاستطلاع");
        } finally {
            setLoading(false);
        }
    };

    const fetchUserResponses = async (pollId: string) => {
        if (!user?.id) return;

        // Fetch Votes
        const { data: responses, error: rError } = await supabase
            .from('poll_responses')
            .select('question_id, option_id')
            .eq('poll_id', pollId)
            .eq('user_id', user.id);

        if (rError) throw rError;

        // Fetch Comment
        const { data: commentData, error: cError } = await supabase
            .from('poll_comments')
            .select('comment_text, is_anonymous')
            .eq('poll_id', pollId)
            .eq('user_id', user.id)
            .maybeSingle();

        if (cError) throw cError;

        if ((responses && responses.length > 0) || commentData) {
            // Populate State
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
            setAnswers({});
            setComment('');
            setIsAnonymous(false);
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
        if (!activePoll || !user?.id) return;

        // Validation
        const unanswered = activePoll.questions.some(q =>
            !answers[q.id] || answers[q.id].length === 0
        );
        if (unanswered) {
            toast.error("يرجى الإجابة على جميع الأسئلة");
            return;
        }

        setSubmitting(true);
        try {
            // 1. Delete old responses (User might be editing)
            await supabase.from('poll_responses').delete()
                .eq('poll_id', activePoll.id).eq('user_id', user.id);

            await supabase.from('poll_comments').delete()
                .eq('poll_id', activePoll.id).eq('user_id', user.id);

            // 2. Prepare new responses
            const responsesToInsert: any[] = [];
            for (const [qId, optionIds] of Object.entries(answers)) {
                for (const optId of optionIds) {
                    responsesToInsert.push({
                        poll_id: activePoll.id,
                        question_id: qId,
                        option_id: optId,
                        user_id: user.id
                    });
                }
            }

            // 3. Insert new responses
            if (responsesToInsert.length > 0) {
                const { error: insertError } = await supabase
                    .from('poll_responses')
                    .insert(responsesToInsert);
                if (insertError) throw insertError;
            }

            // 4. Insert Comment with Anonymous Flag
            if (comment.trim()) {
                const { error: commentError } = await supabase
                    .from('poll_comments')
                    .insert({
                        poll_id: activePoll.id,
                        user_id: user.id,
                        comment_text: comment,
                        is_anonymous: isAnonymous
                    });
                if (commentError) throw commentError;
            }

            toast.success("تم إرسال إجاباتك بنجاح");
            setMode('view');

        } catch (error: any) {
            console.error("Submission error:", error);
            toast.error("حدث خطأ أثناء الإرسال: " + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-green" /></div>;
    }

    if (mode === 'empty') {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center">
                    <PieChart className="w-8 h-8 text-white/20" />
                </div>
                <p className="text-white/40 font-bold">لا يوجد استطلاع نشط حالياً</p>
                <p className="text-white/20 text-sm">يرجى العودة لاحقاً</p>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            {/* Header Card */}
            <GlassCard className="p-6 relative overflow-hidden border-brand-green/20">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-green to-transparent opacity-50" />

                <div className="flex justify-between items-start mb-4">
                    <h2 className="text-2xl font-bold text-white max-w-[70%]">{activePoll?.title}</h2>

                    {/* Anonymous Toggle - Only in Edit Mode */}
                    {mode !== 'view' && (
                        <button
                            onClick={() => setIsAnonymous(!isAnonymous)}
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
                </div>

                <div className="flex items-center gap-2 text-brand-green text-sm font-bold bg-brand-green/10 w-fit px-3 py-1 rounded-full">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>استطلاع رسمي</span>
                </div>
            </GlassCard>

            {/* Questions List */}
            <div className="space-y-4">
                {activePoll?.questions.map((q, idx) => (
                    <div key={q.id} className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
                        <h3 className="text-lg font-bold text-white flex items-start gap-3">
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
                                        disabled={mode === 'view'}
                                        className={cn(
                                            "w-full text-right p-4 rounded-xl border transition-all duration-200 flex items-center justify-between group",
                                            isSelected
                                                ? "bg-brand-green text-white border-brand-green shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                                                : "bg-black/20 text-white/70 border-white/5 hover:bg-white/10",
                                            mode === 'view' && !isSelected && "opacity-50 grayscale"
                                        )}
                                    >
                                        <span className="font-medium">{opt.option_text}</span>
                                        {isSelected && <CheckCircle2 className="w-5 h-5" />}
                                    </button>
                                );
                            })}
                        </div>
                        {q.allow_multiple_answers && (
                            <p className="text-xs text-white/30 pr-11">يمكنك اختيار أكثر من إجابة</p>
                        )}
                    </div>
                ))}
            </div>

            {/* Personal Opinion Section */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
                <label className="text-white font-bold flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-brand-yellow" />
                    رأيي الشخصي
                    <span className="text-xs font-normal text-white/40 bg-white/5 px-2 py-0.5 rounded mr-auto">
                        اختياري
                    </span>
                </label>
                <div className="relative">
                    <textarea
                        value={comment}
                        onChange={(e) => handleCommentChange(e.target.value)}
                        disabled={mode === 'view'}
                        placeholder="اكتب ملاحظاتك أو مقترحاتك هنا..."
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-brand-green/50 min-h-[100px] max-h-[200px] resize-y custom-scrollbar"
                    />
                    <div className={cn(
                        "absolute bottom-3 left-3 text-xs font-mono px-2 py-1 rounded bg-black/50 border border-white/10",
                        wordCount >= MAX_WORDS ? "text-red-400" : "text-white/40"
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
                                <p className="text-xs text-white/50">شكراً لمشاركتك رأيك معنا</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setMode('edit')}
                            className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors"
                        >
                            <span>تعديل الإجابات</span>
                            <Edit className="w-4 h-4" />
                        </button>
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
    );
}
