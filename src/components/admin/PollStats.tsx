import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { User, Clock, ArrowRight, MessageSquare, Loader2, Printer } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { GlassCard } from '../ui/GlassCard';

interface PollStatsProps {
    pollId: string;
    onBack: () => void;
}

export function PollStats({ pollId, onBack }: PollStatsProps) {
    const [loading, setLoading] = useState(true);
    const [poll, setPoll] = useState<any>(null);
    const [stats, setStats] = useState<any[]>([]);
    const [comments, setComments] = useState<any[]>([]);
    const [totalVotes, setTotalVotes] = useState(0);
    const [isCommentsExpanded, setIsCommentsExpanded] = useState(false); // Default folded as requested

    useEffect(() => {
        fetchStats();
    }, [pollId]);

    const fetchStats = async () => {
        try {
            setLoading(true);

            // 1. Fetch Poll Info
            const { data: pollData, error: pError } = await supabase
                .from('polls')
                .select('title, created_at')
                .eq('id', pollId)
                .single();
            if (pError) throw pError;
            setPoll(pollData);

            // 2. Fetch Questions & Options
            const { data: qData, error: qError } = await supabase
                .from('poll_questions')
                .select(`
                    id, question_text, order_index,
                    poll_options (id, option_text, order_index)
                `)
                .eq('poll_id', pollId)
                .order('order_index');
            if (qError) throw qError;

            // 3. Fetch ALL Responses (Client-side aggregation for now)
            const { data: rData, error: rError } = await supabase
                .from('poll_responses')
                .select('question_id, option_id, user_id')
                .eq('poll_id', pollId);
            if (rError) throw rError;

            // 4. Fetch Comments
            const { data: cData, error: cError } = await supabase
                .from('poll_comments')
                .select(`
                    comment_text, created_at,
                    app_users (full_name, job_number)
                `)
                .eq('poll_id', pollId)
                .order('created_at', { ascending: false });
            if (cError) throw cError;

            // --- Process Data ---

            // Count Unique Voters
            const uniqueVoters = new Set(rData?.map(r => r.user_id)).size;
            setTotalVotes(uniqueVoters);

            // Aggregate Counts
            const counts: Record<string, number> = {}; // option_id -> count
            const questionTotals: Record<string, number> = {}; // question_id -> total responses

            rData?.forEach(r => {
                counts[r.option_id] = (counts[r.option_id] || 0) + 1;
                questionTotals[r.question_id] = (questionTotals[r.question_id] || 0) + 1;
            });

            // Build Stats Object
            const processedStats = qData?.map(q => {
                const qTotal = questionTotals[q.id] || 0;
                return {
                    id: q.id,
                    text: q.question_text,
                    total: qTotal,
                    options: q.poll_options
                        .sort((a: any, b: any) => a.order_index - b.order_index)
                        .map((opt: any) => {
                            const count = counts[opt.id] || 0;
                            const percentage = qTotal > 0 ? Math.round((count / qTotal) * 100) : 0;
                            return {
                                ...opt,
                                count,
                                percentage
                            };
                        })
                };
            });

            setStats(processedStats || []);
            setComments(cData || []);

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-brand-green" /></div>;

    return (
        <div id="poll-stats-print-root" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                {/* Print Button - Rendered in Admin Dashboard Header via Portal */}
                {createPortal(
                    <button
                        onClick={() => window.print()}
                        className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-all print:hidden"
                    >
                        <Printer className="w-5 h-5" />
                        <span className="hidden md:inline">طباعة التقرير</span>
                        <span className="md:hidden">طباعة</span>
                    </button>,
                    document.getElementById('admin-header-portal') || document.body
                )}

                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-white print:hidden"
                    >
                        <ArrowRight className="w-5 h-5 rtl:rotate-180" />
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-2">{poll?.title}</h2>
                        <div className="flex items-center gap-4 text-sm text-white/50 print:text-black mt-1">
                            <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {new Date(poll?.created_at).toLocaleDateString('ar-IQ')}
                            </span>
                            <span className="flex items-center gap-1 text-brand-green font-bold bg-brand-green/10 px-2 py-0.5 rounded-full print:bg-transparent print:text-black print:border print:border-black">
                                <User className="w-4 h-4" />
                                {totalVotes} مشارك
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Questions Stats */}
            <div className="grid gap-6">
                {stats.map((q, idx) => (
                    <GlassCard key={q.id} className="p-6 break-inside-avoid">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-start gap-3">
                            <span className="bg-white/10 w-8 h-8 flex items-center justify-center rounded-lg text-sm font-mono shrink-0 print:border print:border-black print:text-black">
                                {idx + 1}
                            </span>
                            {q.text}
                        </h3>

                        <div className="space-y-4">
                            {q.options.map((opt: any) => (
                                <div key={opt.id} className="group relative">
                                    {/* Text & Count */}
                                    <div className="flex justify-between items-end mb-1 relative z-10 px-1">
                                        <span className="font-medium text-white/90 group-hover:text-white transition-colors">
                                            {opt.option_text}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-white/40">{opt.count} صوت</span>
                                            <span className="font-mono font-bold text-brand-green text-lg">
                                                {opt.percentage}%
                                            </span>
                                        </div>
                                    </div>

                                    {/* Bar Container */}
                                    <div className="h-3 bg-black/40 rounded-full overflow-hidden relative border border-white/5 progress-bg">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${opt.percentage}%` }}
                                            transition={{ duration: 1, ease: "easeOut" }}
                                            className={cn(
                                                "h-full rounded-full relative overflow-hidden progress-fill",
                                                opt.percentage > 50 ? "bg-gradient-to-r from-brand-green to-emerald-600" :
                                                    opt.percentage > 20 ? "bg-gradient-to-r from-blue-500 to-indigo-600" :
                                                        "bg-white/20"
                                            )}
                                        >
                                            <div className="absolute inset-0 bg-white/20 animate-pulse-slow print:hidden" />
                                        </motion.div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </GlassCard>
                ))}
            </div>

            {/* Comments Section */}
            {comments.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-white/10 print:border-none">
                    <button
                        onClick={() => setIsCommentsExpanded(!isCommentsExpanded)}
                        className="w-full flex items-center justify-between group cursor-pointer focus:outline-none"
                    >
                        <h3 className="text-xl font-bold text-white flex items-center gap-2 comments-section-title group-hover:text-brand-yellow transition-colors">
                            <MessageSquare className="w-6 h-6 text-brand-yellow print:text-black" />
                            صوت الناس
                            <span className="text-sm font-normal text-white/40 print:text-black">({comments.length} تعليق)</span>
                        </h3>
                        {/* Chevron for indication */}
                        <motion.div
                            animate={{ rotate: isCommentsExpanded ? 180 : 0 }}
                            className="text-white/30 group-hover:text-white print:hidden"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                        </motion.div>
                    </button>

                    <div className={cn(
                        "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 comments-grid transition-all duration-300 overflow-hidden",
                        isCommentsExpanded ? "opacity-100 max-h-[5000px]" : "opacity-0 max-h-0 print:opacity-100 print:max-h-none print:h-auto print:block"
                    )}>
                        {comments.map((comment, i) => (
                            <div key={i} className="comment-card bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 p-4 rounded-xl transition-all duration-300 group break-inside-avoid">
                                <p className="text-white/80 leading-relaxed text-sm min-h-[60px] mb-3">
                                    "{comment.comment_text}"
                                </p>
                                <div className="flex items-center justify-between border-t border-white/5 pt-3 print:border-black/20">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-brand-green to-blue-500 flex items-center justify-center text-[10px] font-bold text-white print:bg-none print:border print:border-black print:text-black">
                                            {comment.app_users?.full_name?.charAt(0) || '?'}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-white/60 group-hover:text-white transition-colors print:text-black">
                                                {comment.app_users?.full_name || 'مستخدم غير معروف'}
                                            </span>
                                            <span className="text-[10px] text-white/30 font-mono print:text-black/70">
                                                {comment.app_users?.job_number}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="text-[10px] text-white/30 print:text-black/70">
                                        {new Date(comment.created_at).toLocaleDateString('ar-IQ')}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
