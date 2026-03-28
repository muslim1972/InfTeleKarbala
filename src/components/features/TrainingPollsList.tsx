import { usePolls } from '../../hooks/usePolls';
import { useMediaContent } from '../../hooks/useMediaContent';
import { useAuth } from '../../context/AuthContext';
import { PollItem } from './PollItem';
import { Loader2, PieChart, ExternalLink } from 'lucide-react';

export function TrainingPollsList() {
    const { user } = useAuth();
    const { data: mediaContent, isLoading: mediaLoading } = useMediaContent(user?.id);
    const { data: polls, isLoading: pollsLoading } = usePolls('training');
    
    const activePolls = polls || [];
    const pollLink = mediaContent?.pollLinkTraining || null;
    const isLoading = mediaLoading || pollsLoading;

    if (isLoading) {
        return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-green" /></div>;
    }

    return (
        <div className="space-y-4">
            {/* Poll Link Section */}
            {pollLink && pollLink.is_active && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-500 delay-150 mb-6">
                    <a
                        href={pollLink.content.startsWith('http') ? pollLink.content : `https://${pollLink.content}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-4 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl group transition-all hover:bg-brand-green/5 hover:border-brand-green/30 shadow-sm"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-brand-green/10 rounded-xl flex items-center justify-center text-brand-green group-hover:scale-110 transition-transform">
                                <ExternalLink size={20} />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-gray-900 dark:text-white/90">
                                    {pollLink.title || 'رابط مهم'}
                                </h4>
                                <p className="text-xs text-brand-green font-medium mt-0.5 truncate max-w-[200px] md:max-w-xs">{pollLink.content}</p>
                            </div>
                        </div>
                        <div className="bg-brand-green/10 px-3 py-1.5 rounded-lg text-brand-green text-xs font-bold group-hover:bg-brand-green group-hover:text-white transition-all">
                            زيارة الرابط
                        </div>
                    </a>
                </div>
            )}

            {/* Polls List */}
            {activePolls.length > 0 ? (
                activePolls.map(poll => (
                    <PollItem key={poll.id} poll={poll} />
                ))
            ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                    <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center border border-border">
                        <PieChart className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground font-bold text-sm">لا توجد استطلاعات للتدريب الصيفي حالياً</p>
                </div>
            )}
        </div>
    );
}
