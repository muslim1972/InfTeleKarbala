import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { ExternalLink } from 'lucide-react';

export const TraineePollLink = () => {
    // استخدم React Query حسب أفضل ممارسات Vercel
    const { data: pollLink } = useQuery({
        queryKey: ['trainee_poll_link'],
        queryFn: async () => {
            const { data } = await supabase
                .from('media_content')
                .select('id, content, title, is_active')
                .eq('type', 'poll_link_training')
                .limit(1)
                .maybeSingle();
            return data;
        },
        staleTime: 5000,
        refetchOnMount: 'always',
    });

    if (!pollLink || !pollLink.is_active || !pollLink.content) return null;

    return (
        <div className="animate-in fade-in slide-in-from-top-4 duration-500 mt-6">
            <a
                href={pollLink.content?.startsWith('http') ? pollLink.content : `https://${pollLink.content}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white dark:bg-white/5 border border-brand-green/30 dark:border-brand-green/50 rounded-2xl group transition-all hover:bg-brand-green/5 dark:hover:bg-brand-green/10 shadow-sm gap-4"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-brand-green/10 dark:bg-brand-green/20 rounded-xl flex items-center justify-center text-brand-green group-hover:scale-110 transition-transform shrink-0">
                        <ExternalLink size={20} />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white/90">
                            {pollLink.title || 'رابط استطلاع مهم . يرجى اكماله'}
                        </h4>
                        <p className="text-xs text-brand-green font-medium mt-0.5 truncate max-w-[200px] sm:max-w-xs">{pollLink.content}</p>
                    </div>
                </div>
                <div className="bg-brand-green/10 dark:bg-brand-green/20 px-4 py-2 rounded-lg text-brand-green dark:text-brand-green text-xs font-bold group-hover:bg-brand-green group-hover:text-white transition-all text-center whitespace-nowrap">
                    زيارة الرابط
                </div>
            </a>
        </div>
    );
};
