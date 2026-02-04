import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';
import { Loader2, PieChart } from 'lucide-react';
import { PollItem, type Poll } from './PollItem';
import { DirectivesModal } from './DirectivesModal';
import { AlertCircle, Users } from 'lucide-react'; // Using Users for Conferences (green)

export function UserPolls() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [activePolls, setActivePolls] = useState<Poll[]>([]);

    // Directives & Conferences State
    const [directive, setDirective] = useState<{ id: string, content: string } | null>(null);
    const [conference, setConference] = useState<{ id: string, content: string } | null>(null);
    const [isDirectiveAcknowledged, setIsDirectiveAcknowledged] = useState(false);

    const [modalData, setModalData] = useState<{ type: 'directive' | 'conference', content: string } | null>(null);

    useEffect(() => {
        if (user?.id) {
            fetchActivePolls();
            fetchMediaContent();
        }
    }, [user?.id]);

    const fetchMediaContent = async () => {
        try {
            // 1. Fetch Active Directive
            const { data: dirData } = await supabase
                .from('media_content')
                .select('id, content')
                .eq('type', 'directive')
                .eq('is_active', true)
                .limit(1)
                .maybeSingle();

            setDirective(dirData);

            // 2. Check Acknowledgment if directive exists
            if (dirData && user?.id) {
                const { data: ackData } = await supabase
                    .from('user_acknowledgments')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('content_id', dirData.id)
                    .maybeSingle();

                setIsDirectiveAcknowledged(!!ackData);
            }

            // 3. Fetch Active Conference
            const { data: confData } = await supabase
                .from('media_content')
                .select('id, content')
                .eq('type', 'conference')
                .eq('is_active', true)
                .limit(1)
                .maybeSingle();

            setConference(confData);

        } catch (error) {
            console.error("Error fetching media content:", error);
        }
    };

    const fetchActivePolls = async () => {
        setLoading(true);
        try {
            // 1. Get all active active polls (non-deleted)
            const { data: pollsData, error: pollsError } = await supabase
                .from('polls')
                .select('*')
                .eq('is_deleted', false)
                .order('created_at', { ascending: false });

            if (pollsError) throw pollsError;

            if (!pollsData || pollsData.length === 0) {
                setActivePolls([]);
                // Do NOT return here, we still need to show Media buttons if they exist
            } else {
                // 2. Fetch Questions & Options for ALL retrieved polls
                const pollIds = pollsData.map(p => p.id);
                const { data: questionsData, error: qError } = await supabase
                    .from('poll_questions')
                    .select('id, question_text, allow_multiple_answers, order_index, poll_id, poll_options(id, option_text, order_index)')
                    .in('poll_id', pollIds)
                    .order('order_index');

                if (qError) throw qError;

                // 3. Assemble the data structure
                const pollsWithQuestions = pollsData.map(poll => {
                    const pollQuestions = questionsData
                        .filter((q: any) => q.poll_id === poll.id)
                        .map((q: any) => ({
                            ...q,
                            ...q, // Remove duplicate spread
                            options: q.poll_options.sort((a: any, b: any) => a.order_index - b.order_index)
                        }));

                    return {
                        id: poll.id,
                        title: poll.title,
                        description: poll.description,
                        is_active: poll.is_active,
                        questions: pollQuestions
                    };
                });

                setActivePolls(pollsWithQuestions);
            }

        } catch (error) {
            console.error("Error fetching polls:", error);
            toast.error("حدث خطأ أثناء تحميل الاستطلاعات");
        } finally {
            setLoading(false);
        }
    };

    const handleAcknowledgeDirective = async () => {
        if (!user?.id || !directive) return;

        const { error } = await supabase
            .from('user_acknowledgments')
            .insert({
                user_id: user.id,
                content_id: directive.id
            });

        if (error) {
            toast.error("فشل في تأكيد القراءة");
            throw error;
        }

        toast.success("تم تأكيد القراءة");
        setIsDirectiveAcknowledged(true);
        setModalData(null);
    };

    if (loading) {
        return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-green" /></div>;
    }

    return (
        <div className="max-w-2xl mx-auto space-y-8 pb-20">

            {/* Header Buttons Section */}
            {(conference || (directive && !isDirectiveAcknowledged)) && (
                <div className="flex flex-col sm:flex-row gap-3">
                    {/* Conference Button (Green) */}
                    {conference && (
                        <button
                            onClick={() => setModalData({ type: 'conference', content: conference.content })}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-xl p-3 flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-600/20 group hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <div className="bg-white/20 p-1.5 rounded-full">
                                <Users size={20} />
                            </div>
                            <span className="font-bold text-base">المؤتمرات</span>
                        </button>
                    )}

                    {/* Directive Button (Red) */}
                    {directive && !isDirectiveAcknowledged && (
                        <button
                            onClick={() => setModalData({ type: 'directive', content: directive.content })}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl p-3 flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-600/30 relative overflow-hidden group animate-pulse-slow hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <div className="bg-white/20 p-1.5 rounded-full z-10">
                                <AlertCircle size={20} />
                            </div>
                            <span className="font-bold text-base z-10">توجهيات هامة</span>

                            {/* Shiny effect overlay */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shine" />
                        </button>
                    )}
                </div>
            )}


            {/* Polls List */}
            {activePolls.length > 0 ? (
                activePolls.map(poll => (
                    <PollItem key={poll.id} poll={poll} />
                ))
            ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center">
                        <PieChart className="w-8 h-8 text-white/20" />
                    </div>
                    {/* Only show "No polls" message if NO media buttons are present either, to avoid clutter? Or always show it below buttons? User didn't specify. Keeping it simple. */}
                    <p className="text-white/40 font-bold">لا توجد استطلاعات نشطة حالياً</p>
                </div>
            )}

            {/* Modals */}
            <DirectivesModal
                isOpen={!!modalData}
                type={modalData?.type || 'conference'}
                content={modalData?.content || ''}
                onClose={() => setModalData(null)}
                onAcknowledge={modalData?.type === 'directive' ? handleAcknowledgeDirective : undefined}
            />
        </div>
    );
}
