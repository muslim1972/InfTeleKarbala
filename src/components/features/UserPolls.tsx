/**
 * UserPolls - مكون الاستطلاعات والإعلام
 * محسّن باستخدام نظام الكاش الجديد
 */

import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';
import { Loader2, PieChart, AlertCircle, Users } from 'lucide-react';
import { PollItem } from './PollItem';
import { DirectivesModal } from './DirectivesModal';
import { useMediaContent } from '../../hooks/useMediaContent';
import { usePolls } from '../../hooks/usePolls';


export function UserPolls() {
    const { user } = useAuth();

    // استخدام الـ hooks الجديدة للكاش
    const { data: mediaContent, isLoading: mediaLoading, invalidateCache: invalidateMediaCache } = useMediaContent(user?.id);
    const { data: polls, isLoading: pollsLoading } = usePolls();

    const [modalData, setModalData] = useState<{ type: 'directive' | 'conference', content: string } | null>(null);

    // استخراج البيانات من الكاش
    const directive = mediaContent?.directive || null;
    const conference = mediaContent?.conference || null;
    const isDirectiveAcknowledged = mediaContent?.isDirectiveAcknowledged || false;
    const activePolls = polls || [];
    const loading = mediaLoading || pollsLoading;

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
        setModalData(null);

        // إعادة تحميل الكاش لتحديث حالة الإقرار
        await invalidateMediaCache();
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
                            <span className="font-bold text-base">النشاطات</span>
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
                    <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center border border-border">
                        <PieChart className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground font-bold">لا توجد استطلاعات نشطة حالياً</p>
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
