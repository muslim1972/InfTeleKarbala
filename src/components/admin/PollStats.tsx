import { useState, useEffect } from 'react';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { createPortal } from 'react-dom';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { User, Clock, ArrowRight, MessageSquare, Loader2, Printer } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { GlassCard } from '../ui/GlassCard';

interface PollStatsProps {
    pollId: string;
    onBack?: () => void;
}

export function PollStats({ pollId, onBack }: PollStatsProps) {
    const [loading, setLoading] = useState(true);
    const [poll, setPoll] = useState<any>(null);
    const [stats, setStats] = useState<any[]>([]);
    const [comments, setComments] = useState<any[]>([]);
    const [totalVotes, setTotalVotes] = useState(0);

    // UI States
    const [isCommentsExpanded, setIsCommentsExpanded] = useState(false);
    const [printMode, setPrintMode] = useState<'full' | 'summary'>('full');
    const [showPrintMenu, setShowPrintMenu] = useState(false);

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

            // 3. Fetch ALL Responses
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
            const uniqueVoters = new Set(rData?.map(r => r.user_id)).size;
            setTotalVotes(uniqueVoters);

            const counts: Record<string, number> = {};
            const questionTotals: Record<string, number> = {};

            rData?.forEach(r => {
                counts[r.option_id] = (counts[r.option_id] || 0) + 1;
                questionTotals[r.question_id] = (questionTotals[r.question_id] || 0) + 1;
            });

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
                            return { ...opt, count, percentage };
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

    const handlePrint = (mode: 'full' | 'summary') => {
        setPrintMode(mode);
        setShowPrintMenu(false);

        // Target the DEDICATED hidden report container, NOT the live UI
        const element = document.getElementById('poll-pdf-report');
        if (!element) return;

        const opt: any = {
            margin: [10, 10, 10, 10], // mm
            filename: `poll-report-${pollId}-${mode}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                scrollY: 0,
                windowWidth: 800 // Force standard A4-ish width
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        const toastId = toast.loading('جاري تجهيز ملف PDF...');

        // Briefly make it visible in valid DOM flow (but absolute) to ensure layout engine catches it
        // html2pdf can sometimes fail on display:none, so we use z-index hiding
        element.style.display = 'block';

        html2pdf().from(element).set(opt).save()
            .then(() => {
                toast.success('تم حفظ التقرير بنجاح', { id: toastId });
            })
            .catch((err: any) => {
                console.error("PDF Export Error:", err);
                toast.error('فشل في تصدير التقرير', { id: toastId });
            })
            .finally(() => {
                element.style.display = 'none'; // Hide it again
            });
    };

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-brand-green" /></div>;

    return (
        <>
            {/* LIVE ON-SCREEN UI (Dark Mode) */}
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Header */}
                <div className="flex items-center justify-between gap-4">
                    {/* Print Button Options - Rendered in Admin Dashboard Header via Portal */}
                    {createPortal(
                        <div className="relative">
                            <button
                                onClick={() => setShowPrintMenu(!showPrintMenu)}
                                className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-all"
                            >
                                <Printer className="w-5 h-5" />
                                <span className="hidden md:inline">تصدير PDF</span>
                                <span className="md:hidden">PDF</span>
                            </button>

                            {/* Print Dropdown Menu */}
                            {showPrintMenu && (
                                <div className="absolute top-full right-0 mt-2 w-48 bg-zinc-900 border border-white/10 rounded-xl shadow-xl overflow-hidden z-[100] animate-in fade-in zoom-in-95 duration-200">
                                    <button
                                        onClick={() => handlePrint('full')}
                                        className="w-full text-right px-4 py-3 text-sm text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                                    >
                                        <span className="w-2 h-2 rounded-full bg-brand-green"></span>
                                        تقرير كامل
                                    </button>
                                    <button
                                        onClick={() => handlePrint('summary')}
                                        className="w-full text-right px-4 py-3 text-sm text-white hover:bg-white/5 transition-colors border-t border-white/5 flex items-center gap-2"
                                    >
                                        <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                                        ملخص
                                    </button>
                                </div>
                            )}

                            {/* Overlay to close menu */}
                            {showPrintMenu && (
                                <div
                                    className="fixed inset-0 z-40 bg-transparent"
                                    onClick={() => setShowPrintMenu(false)}
                                />
                            )}
                        </div>,
                        document.getElementById('admin-header-portal') || document.body
                    )}

                    <div className="flex items-center gap-4">
                        <button
                            onClick={onBack}
                            className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-white"
                        >
                            <ArrowRight className="w-5 h-5 rtl:rotate-180" />
                        </button>
                        <div>
                            <h2 className={cn("text-2xl font-bold mb-2", "text-white")}>{poll?.title}</h2>
                            <div className={cn("flex items-center gap-4 text-sm mt-1", "text-white/50")}>
                                <span className="flex items-center gap-1">
                                    <Clock className="w-4 h-4" />
                                    {new Date(poll?.created_at).toLocaleDateString('ar-IQ')}
                                </span>
                                <span className={cn(
                                    "flex items-center gap-1 font-bold px-2 py-0.5 rounded-full",
                                    "bg-brand-green/10 text-brand-green"
                                )}>
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
                        <GlassCard key={q.id} className={cn(
                            "p-6 break-inside-avoid"
                        )}>
                            <h3 className={cn("text-lg font-bold mb-6 flex items-start gap-3", "text-white")}>
                                <span className={cn(
                                    "w-8 h-8 flex items-center justify-center rounded-lg text-sm font-mono shrink-0",
                                    "bg-white/10"
                                )}>
                                    {idx + 1}
                                </span>
                                {q.text}
                            </h3>

                            <div className="space-y-4">
                                {q.options.map((opt: any) => (
                                    <div key={opt.id} className="group relative">
                                        {/* Text & Count */}
                                        <div className="flex justify-between items-end mb-1 relative z-10 px-1">
                                            <span className={cn("font-medium transition-colors", "text-white/90 group-hover:text-white")}>
                                                {opt.option_text}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className={cn("text-xs", "text-white/40")}>{opt.count} صوت</span>
                                                <span className="font-mono font-bold text-brand-green text-lg">
                                                    {opt.percentage}%
                                                </span>
                                            </div>
                                        </div>

                                        {/* Bar Container */}
                                        <div className={cn("h-3 rounded-full overflow-hidden relative", "bg-black/40 border border-white/5")}>
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${opt.percentage}%` }}
                                                transition={{ duration: 1, ease: "linear" }}
                                                className={cn(
                                                    "h-full rounded-full relative overflow-hidden",
                                                    opt.percentage > 50 ? "bg-gradient-to-r from-brand-green to-emerald-600" :
                                                        opt.percentage > 20 ? "bg-gradient-to-r from-blue-500 to-indigo-600" :
                                                            "bg-white/20"
                                                )}
                                            >
                                                <div className="absolute inset-0 bg-white/20 animate-pulse-slow" />
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
                    <div className="space-y-4 pt-4 border-t border-white/10">
                        <button
                            onClick={() => setIsCommentsExpanded(!isCommentsExpanded)}
                            className="w-full flex items-center justify-between group cursor-pointer focus:outline-none"
                        >
                            <h3 className="text-xl font-bold text-white flex items-center gap-2 comments-section-title group-hover:text-brand-yellow transition-colors">
                                <MessageSquare className="w-6 h-6 text-brand-yellow" />
                                صوت الناس
                                <span className="text-sm font-normal text-white/40">({comments.length} تعليق)</span>
                            </h3>
                            {/* Chevron for indication */}
                            <motion.div
                                animate={{ rotate: isCommentsExpanded ? 180 : 0 }}
                                className="text-white/30 group-hover:text-white"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                            </motion.div>
                        </button>

                        <div className={cn(
                            "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 comments-grid transition-all duration-300 overflow-hidden",
                            isCommentsExpanded ? "opacity-100 max-h-[5000px]" : "opacity-0 max-h-0"
                        )}>
                            {comments.map((comment, i) => (
                                <div key={i} className="comment-card bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 p-4 rounded-xl transition-all duration-300 group break-inside-avoid">
                                    <p className="text-white/80 leading-relaxed text-sm min-h-[60px] mb-3">
                                        "{comment.comment_text}"
                                    </p>
                                    <div className="flex items-center justify-between border-t border-white/5 pt-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-brand-green to-blue-500 flex items-center justify-center text-[10px] font-bold text-white">
                                                {comment.app_users?.full_name?.charAt(0) || '?'}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-white/60 group-hover:text-white transition-colors">
                                                    {comment.app_users?.full_name || 'مستخدم غير معروف'}
                                                </span>
                                                <span className="text-[10px] text-white/30 font-mono">
                                                    {comment.app_users?.job_number}
                                                </span>
                                            </div>
                                        </div>
                                        <span className="text-[10px] text-white/30">
                                            {new Date(comment.created_at).toLocaleDateString('ar-IQ')}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>


            {/* ==========================================================================================
                HIDDEN PRINT TEMPLATE - This is what generates the PDF
                Strictly typed to be Black-on-White. No Glassmorphism. Standard Table-like Layout.
            ========================================================================================== */}
            <div
                id="poll-pdf-report"
                style={{ display: 'none', width: '800px', backgroundColor: 'white', color: 'black' }} // Force explicit inline styles for safety
                className="p-8 bg-white text-black font-sans" // Tailwind fallback
            >
                {/* PDF Header */}
                <div className="border-b-2 border-black pb-4 mb-8 flex items-start justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-black mb-2">{poll?.title}</h1>
                        <p className="text-gray-600 text-sm">تم استخراج التقرير بتاريخ: {new Date().toLocaleDateString('ar-IQ')}</p>
                    </div>
                    <div className="text-left">
                        <div className="bg-gray-100 border border-gray-300 rounded px-3 py-1 inline-flex items-center gap-2">
                            <span className="font-bold text-black">{totalVotes}</span>
                            <span className="text-gray-600 text-sm">مشارك في الاستطلاع</span>
                        </div>
                    </div>
                </div>

                {/* PDF Stats Grid */}
                <div className="space-y-8">
                    {stats.map((q, idx) => (
                        <div key={q.id} className="break-inside-avoid border border-gray-200 rounded-lg p-4 bg-white">
                            <h3 className="text-xl font-bold text-black mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 flex items-center justify-center bg-gray-100 border border-gray-300 rounded text-black text-sm">
                                    {idx + 1}
                                </span>
                                {q.text}
                            </h3>

                            <div className="space-y-3">
                                {q.options.map((opt: any) => (
                                    <div key={opt.id}>
                                        <div className="flex justify-between items-end mb-1 text-sm text-black">
                                            <span className="font-bold">{opt.option_text}</span>
                                            <div className="flex gap-4">
                                                <span className="text-gray-600">{opt.count} صوت</span>
                                                <span className="font-bold">{opt.percentage}%</span>
                                            </div>
                                        </div>
                                        {/* Simple PDF-safe Progress bar */}
                                        <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden border border-gray-300">
                                            <div
                                                className="h-full bg-black/70" // Use dark gray/black for elegant monochromatic print
                                                style={{ width: `${opt.percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* PDF Comments (Only if Full Mode) */}
                {printMode === 'full' && comments.length > 0 && (
                    <div className="mt-12 pt-8 border-t-2 border-black break-before-page">
                        <h3 className="text-2xl font-bold text-black mb-6 flex items-center gap-2">
                            <span>💬</span> تعليقات المشاركين ({comments.length})
                        </h3>
                        <div className="grid grid-cols-1 gap-4">
                            {comments.map((c, i) => (
                                <div key={i} className="bg-gray-50 p-4 rounded border border-gray-300 break-inside-avoid">
                                    <p className="text-black text-base italic mb-3 leading-relaxed">"{c.comment_text}"</p>
                                    <div className="flex justify-between items-center text-xs text-gray-500 border-t border-gray-200 pt-2">
                                        <span className="font-bold text-gray-700">{c.app_users?.full_name || 'مجهول'}</span>
                                        <span>{new Date(c.created_at).toLocaleDateString('ar-IQ')}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="mt-12 pt-4 border-t border-gray-300 text-center text-xs text-gray-400">
                    تم إنشاء هذا التقرير تلقائياً بواسطة نظام InfTeleKarbala
                </div>
            </div>
        </>
    );
}
