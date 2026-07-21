import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { ExternalLink } from 'lucide-react';

export const TraineePollLink = () => {
    // استخدم React Query حسب أفضل ممارسات Vercel
    const { data: pollLink } = useQuery({
        queryKey: ['trainee_poll_link'],
        queryFn: async () => {
            // المحاولة الأولى: رابط التدريب الصيفي الخاص
            const { data: trainingData } = await supabase
                .from('media_content')
                .select('id, content, title, is_active')
                .eq('type', 'poll_link_training')
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (trainingData && trainingData.content) {
                return trainingData;
            }

            // المحاولة الثانية: رابط الاستطلاع العام كخيار بديل
            const { data: generalData } = await supabase
                .from('media_content')
                .select('id, content, title, is_active')
                .eq('type', 'poll_link')
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            return generalData;
        },
        staleTime: 2000,
        refetchOnMount: 'always',
    });

    const isAvailable = pollLink && pollLink.is_active && pollLink.content;
    const title = pollLink?.title || 'رابط استطلاع مهم . يرجى اكماله';
    const content = pollLink?.content || '';
    
    const Wrapper = isAvailable ? 'a' : 'div';
    const wrapperProps = isAvailable ? {
        href: content.startsWith('http') ? content : `https://${content}`,
        target: "_blank",
        rel: "noopener noreferrer"
    } : {};

    return (
        <div className="animate-in fade-in slide-in-from-top-4 duration-500 mt-6">
            <Wrapper
                {...wrapperProps}
                className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white dark:bg-white/5 border border-brand-green/30 dark:border-brand-green/50 rounded-2xl transition-all shadow-sm gap-4 ${isAvailable ? 'group hover:bg-brand-green/5 dark:hover:bg-brand-green/10 cursor-pointer' : 'opacity-70'}`}
            >
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 bg-brand-green/10 dark:bg-brand-green/20 rounded-xl flex items-center justify-center text-brand-green shrink-0 ${isAvailable ? 'group-hover:scale-110 transition-transform' : ''}`}>
                        <ExternalLink size={20} />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white/90">
                            {title}
                        </h4>
                        <p className="text-xs text-brand-green font-medium mt-0.5 truncate max-w-[200px] sm:max-w-xs">{content}</p>
                    </div>
                </div>
                <div className={`bg-brand-green/10 dark:bg-brand-green/20 px-4 py-2 rounded-lg text-brand-green dark:text-brand-green text-xs font-bold transition-all text-center whitespace-nowrap ${isAvailable ? 'group-hover:bg-brand-green group-hover:text-white' : ''}`}>
                    زيارة الرابط
                </div>
            </Wrapper>
        </div>
    );
};
