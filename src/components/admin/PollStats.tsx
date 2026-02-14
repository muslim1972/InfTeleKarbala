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
import { formatDate } from '../../utils/formatDate';

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
                    comment_text, created_at, is_anonymous,
                    profiles (full_name, job_number)
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

        // Target the DEDICATED hidden report container
        const element = document.getElementById('poll-pdf-report');
        if (!element) return;

        const opt: any = {
            margin: [15, 10, 15, 10], // Increased top/bottom margin for headers/footers
            filename: `poll-report-${pollId}-${mode}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                scrollY: 0,
                windowWidth: 800
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] } // Smart page breaking
        };

        const toastId = toast.loading('جاري إصدار التقرير...');

        element.style.display = 'block';

        // Advanced Pipeline: HTML -> PDF Object -> Edit Pages -> Save
        const worker = html2pdf().from(element).set(opt).toPdf();

        worker.get('pdf').then((pdf: any) => {
            const totalPages = pdf.internal.getNumberOfPages();
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();

            // "Running Header" loop - Adds Title & Page Num to EVERY page
            for (let i = 1; i <= totalPages; i++) {
                pdf.setPage(i);

                // Header Line
                pdf.setDrawColor(200, 200, 200);
                pdf.line(10, 10, pageWidth - 10, 10);

                // Header Text (Poll Title - Top Right)
                pdf.setFontSize(10);
                pdf.setTextColor(100, 100, 100);

                // Footer: Page Numbers
                pdf.setFontSize(8);
                pdf.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
            }
        }).then(() => {
            worker.save();
        })
            .then(() => {
                toast.success('تم حفظ التقرير بنجاح', { id: toastId });
            })
            .catch((err: any) => {
                console.error("PDF Export Error:", err);
                toast.error('فشل في تصدير التقرير', { id: toastId });
            })
            .finally(() => {
                element.style.display = 'none';
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
                                    {formatDate(poll?.created_at)}
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

                {/* On-Screen Comments Area */}
                <div className="border-t border-white/10 pt-4">
                    <button onClick={() => setIsCommentsExpanded(!isCommentsExpanded)} className="flex items-center gap-2 text-white font-bold text-lg mb-4">
                        <MessageSquare className="w-5 h-5 text-brand-yellow" />
                        صوت الناس ({comments.length})
                    </button>
                    {isCommentsExpanded && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {comments.map((c, i) => (
                                <div key={i} className="bg-white/5 p-4 rounded-xl border border-white/5">
                                    <p className="text-white/80 text-sm mb-2">"{c.comment_text}"</p>
                                    <div className="flex justify-between text-xs text-white/40">
                                        <span className="flex items-center gap-1">
                                            {c.is_anonymous ? (
                                                <>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                                                    فاعل خير
                                                </>
                                            ) : (
                                                c.profiles?.full_name
                                            )}
                                        </span>
                                        <span>{formatDate(c.created_at)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>


            {/* ==========================================================================================
                HIDDEN PRINT TEMPLATE - HTML Structure for PDF
            ========================================================================================== */}
            <div
                id="poll-pdf-report"
                style={{ display: 'none', width: '800px', backgroundColor: 'white', color: 'black' }}
                className="p-10 bg-white text-black font-sans relative"
            >
                {/* Running Header Placeholder (Visible in HTML copy, helps context) */}
                <div className="absolute top-2 left-10 text-[10px] text-gray-400">
                    InfTeleKarbala Poll System
                </div>

                {/* PDF Header */}
                <div className="border-b-2 border-black pb-6 mb-10 flex items-start justify-between">
                    <div className="max-w-[70%]">
                        <h1 className="text-3xl font-bold text-black mb-3 leading-tight">{poll?.title}</h1>
                        <p className="text-gray-500 text-sm">تاريخ التقرير: {formatDate(new Date())} | المصدر: قسم المعلوماتية</p>
                    </div>
                    <div className="text-left">
                        <div className="bg-gray-100 border border-gray-300 rounded-lg px-4 py-2 flex flex-col items-center">
                            <span className="font-bold text-2xl text-black">{totalVotes}</span>
                            <span className="text-gray-600 text-xs">مشارك للإدلاء بالرأي</span>
                        </div>
                    </div>
                </div>

                {/* PDF Stats Grid */}
                <div className="space-y-6">
                    {stats.map((q, idx) => (
                        <div key={q.id} className="break-inside-avoid border border-gray-200 rounded-lg p-5 bg-white shadow-sm">
                            <h3 className="text-xl font-bold text-black mb-5 flex items-start gap-3">
                                <span className="w-8 h-8 flex items-center justify-center bg-black text-white rounded text-sm shrink-0 mt-0.5">
                                    {idx + 1}
                                </span>
                                {q.text}
                            </h3>

                            <div className="space-y-4">
                                {q.options.map((opt: any) => (
                                    <div key={opt.id}>
                                        <div className="flex justify-between items-end mb-1 text-sm text-black px-1">
                                            <span className="font-bold text-base">{opt.option_text}</span>
                                            <div className="flex items-center gap-4">
                                                <span className="text-gray-500 text-xs">{opt.count} صوت</span>
                                                <span className="font-bold text-base">{opt.percentage}%</span>
                                            </div>
                                        </div>
                                        <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                                            <div
                                                className="h-full bg-black"
                                                style={{ width: `${opt.percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Summary Mode Note */}
                {/* Note: This pushes to the bottom of the last page of stats usually */}
                {printMode === 'summary' && comments.length > 0 && (
                    <div className="mt-8 p-4 bg-gray-50 border border-dashed border-gray-300 rounded text-center break-inside-avoid">
                        <p className="text-gray-600 font-medium">
                            📁 هذا التقرير موجز. يوجد <span className="text-black font-bold mx-1">{comments.length}</span> تعليق تفصيلي من المشاركين لم يتم تضمينها في هذا الإصدار.
                        </p>
                    </div>
                )}

                {/* PDF Comments (Only if Full Mode) */}
                {printMode === 'full' && comments.length > 0 && (
                    <div className="mt-12 break-before-page">
                        {/* Enhanced Comments Header as requested */}
                        <div className="border-b border-black mb-6 pb-2">
                            <h3 className="text-2xl font-bold text-black flex items-center gap-2">
                                📃 سجل تعليقات المشاركين
                            </h3>
                            <p className="text-gray-500 text-sm mt-1">
                                تعليقات وآراء الموظفين حول استطلاع: "{poll?.title?.slice(0, 50)}{poll?.title?.length > 50 ? '...' : ''}"
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            {comments.map((c, i) => (
                                <div key={i} className="bg-gray-50 p-4 rounded border border-gray-200 break-inside-avoid shadow-sm">
                                    <p className="text-black text-base italic mb-3 leading-relaxed font-serif">"{c.comment_text}"</p>
                                    <div className="flex justify-between items-center text-xs text-gray-500 border-t border-gray-200 pt-2 bg-white/50 px-2 -mx-2 -mb-2 mt-2 py-1 rounded-b">
                                        <span className="font-bold text-gray-700 flex items-center gap-1">
                                            {c.is_anonymous ? (
                                                <>
                                                    <span className="w-2 h-2 rounded-full bg-gray-300"></span>
                                                    فاعل خير (هوية مخفية)
                                                </>
                                            ) : (
                                                <>
                                                    👤 {c.profiles?.full_name || 'مجهول'}
                                                    <span className="font-normal text-gray-400 font-mono">({c.profiles?.job_number})</span>
                                                </>
                                            )}
                                        </span>
                                        <span>{formatDate(c.created_at)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
