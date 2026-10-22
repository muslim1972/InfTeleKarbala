import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { useGovernorate } from '../../context/GovernorateContext';
import { useAuth } from '../../context/AuthContext';
import { DEFAULT_GOVERNORATE } from '../../constants/governorates';

interface TipsMarqueeProps {
    appName?: string;
    className?: string;
    manualTips?: string[]; // For preview mode
}

const DEFAULT_SYSTEM_TIPS = [
    'نظام الإدارة والمالية الموحد — مديرية الاتصالات والمعلوماتية',
    'أهلاً بكم في نظام إدارة الموظفين والخدمات الرقمية والحضور الذكي',
    'يرجى توثيق البصمة اليومية في أوقات الدوام الرسمية المحددة'
];

const TipsMarquee = ({ appName = 'InfTeleKarbala', className = '', manualTips }: TipsMarqueeProps) => {
    const [fetchedTips, setFetchedTips] = useState<string[]>([]);
    const [loading, setLoading] = useState(!manualTips);
    const [isPaused, setIsPaused] = useState(false);
    const { activeGovernorate } = useGovernorate();
    const { user } = useAuth();

    useEffect(() => {
        // Skip fetching if manualTips are provided
        if (manualTips) return;

        const activeGov = activeGovernorate || user?.governorate || DEFAULT_GOVERNORATE;

        const fetchTips = async () => {
            try {
                const { data, error } = await supabase
                    .from('admin_tips')
                    .select('content')
                    .eq('app_name', appName)
                    .eq('governorate', activeGov)
                    .order('created_at', { ascending: false });

                if (error) {
                    console.warn('Error fetching tips:', error.message);
                }

                const tipRecord = data && data.length > 0 ? data[0] : null;

                if (tipRecord?.content) {
                    const tipsArray = tipRecord.content
                        .split('\n')
                        .map((t: string) => t.trim())
                        .filter(Boolean);
                    setFetchedTips(tipsArray.length > 0 ? tipsArray : DEFAULT_SYSTEM_TIPS);
                } else {
                    setFetchedTips(DEFAULT_SYSTEM_TIPS);
                }
            } catch (err) {
                console.error('Error fetching tips:', err);
                setFetchedTips(DEFAULT_SYSTEM_TIPS);
            } finally {
                setLoading(false);
            }
        };

        fetchTips();

        // Realtime subscription
        const channel = supabase
            .channel(`admin-tips-realtime-${activeGov}`)
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'admin_tips', 
                filter: `app_name=eq.${appName}` // We will filter by governorate client-side to ensure we don't miss events if realtime filters are limited
            }, (payload) => {
                const newRec = payload.new as any;
                if (newRec && newRec.governorate === activeGov && newRec.content) {
                    const tipsArray = newRec.content.split('\n').map((t: string) => t.trim()).filter(Boolean);
                    setFetchedTips(tipsArray);
                }
            })
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [appName, !!manualTips, activeGovernorate, user?.governorate]);

    // Don't render until loaded (for fetch mode)
    if (loading && !manualTips) return null;

    // Use derived tips
    const activeTips = manualTips || (fetchedTips.length > 0 ? fetchedTips : DEFAULT_SYSTEM_TIPS);

    // Filter out completely empty chunks just in case, but keep the array
    const validTips = activeTips.filter(t => t.trim().length > 0);

    // For preview, if empty, show placeholder; otherwise show tips or default fallback
    const tipsToDisplay = validTips.length > 0 ? validTips : (manualTips ? ['... معاينة الشريط ...'] : DEFAULT_SYSTEM_TIPS);

    const marqueeText = tipsToDisplay.join('  ⭐⭐⭐⭐⭐  ');
    // For a seamless infinite loop, we need at least two copies and enough content to fill screen
    const duplicatedText = `${marqueeText}  ⭐⭐⭐⭐⭐  ${marqueeText}  ⭐⭐⭐⭐⭐  `;

    return (
        <div
            className={cn(
                "relative overflow-hidden bg-slate-900 border-b border-blue-500/20 h-8 sm:h-9 md:h-10 w-full flex items-center",
                className
            )}
            dir="ltr" 
        >
            {/* Fade Effect */}
            <div className="absolute inset-y-0 left-0 w-8 sm:w-12 bg-gradient-to-r from-slate-900 to-transparent z-20 pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-8 sm:w-12 bg-gradient-to-l from-slate-900 to-transparent z-20 pointer-events-none" />

            <div className="flex whitespace-nowrap min-w-full">
                <div
                    className="flex shrink-0 animate-marquee-infinite-ltr"
                    style={{
                        animationDuration: `${Math.max(duplicatedText.length * 0.1, 15)}s`, 
                        animationPlayState: isPaused ? 'paused' : 'running',
                    }}
                    onPointerDown={() => setIsPaused(true)}
                    onPointerUp={() => setIsPaused(false)}
                    onPointerLeave={() => setIsPaused(false)}
                    onTouchStart={() => setIsPaused(true)}
                    onTouchEnd={() => setIsPaused(false)}
                >
                    <span className="font-bold text-xs sm:text-sm md:text-base text-blue-100 drop-shadow-[0_2px_4px_rgba(30,58,138,0.5)] font-tajawal px-4">
                        {duplicatedText}
                    </span>
                    <span className="font-bold text-xs sm:text-sm md:text-base text-blue-100 drop-shadow-[0_2px_4px_rgba(30,58,138,0.5)] font-tajawal px-4">
                        {duplicatedText}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default TipsMarquee;
