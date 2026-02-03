import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface TipsMarqueeProps {
    appName?: string;
    className?: string;
    manualTips?: string[]; // For preview mode
}

const TipsMarquee = ({ appName = 'InfTeleKarbala', className = '', manualTips }: TipsMarqueeProps) => {
    const [fetchedTips, setFetchedTips] = useState<string[]>([]);
    const [loading, setLoading] = useState(!manualTips);
    const [isPaused, setIsPaused] = useState(false);



    useEffect(() => {
        // Skip fetching if manualTips are provided
        if (manualTips) return;

        const fetchTips = async () => {
            try {
                const { data } = await supabase
                    .from('admin_tips')
                    .select('content')
                    .eq('app_name', appName)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (data?.content) {
                    const tipsArray = data.content
                        .split('\n')
                        .map((t: string) => t.trim())
                        .filter(Boolean);
                    setFetchedTips(tipsArray);
                } else {
                    setFetchedTips([]);
                }
            } catch (err) {
                console.error('Error fetching tips:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchTips();

        // Realtime subscription
        const channel = supabase
            .channel('admin-tips-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_tips', filter: `app_name=eq.${appName}` }, (payload) => {
                if (payload.new && (payload.new as any).content) {
                    const tipsArray = (payload.new as any).content.split('\n').map((t: string) => t.trim()).filter(Boolean);
                    setFetchedTips(tipsArray);
                }
            })
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [appName, !!manualTips]); // Only change fetch behavior if manualTips existence toggles

    // Don't render until loaded (for fetch mode)
    if (loading && !manualTips) return null;

    // Use derived tips
    const activeTips = manualTips || fetchedTips;

    // Filter out completely empty chunks just in case, but keep the array
    const validTips = activeTips.filter(t => t.trim().length > 0);

    // If no valid tips and not in manual mode (preview), don't render anything
    if (!manualTips && validTips.length === 0) return null;

    // For preview, if empty, show placeholder
    const tipsToDisplay = validTips.length > 0 ? validTips : (manualTips ? ['... معاينة الشريط ...'] : []);

    if (tipsToDisplay.length === 0) return null;

    const marqueeText = tipsToDisplay.join('  ★★★★★  ');
    const duplicatedText = `${marqueeText}  ★★★★★  ${marqueeText}  ★★★★★  `;

    return (
        <div
            className={`relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 
                  border-b border-blue-500/20 h-10 flex items-center ${className}`}
        >
            {/* Fade Effect */}
            <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-slate-900 to-transparent z-10 pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-slate-900 to-transparent z-10 pointer-events-none" />

            <div className="w-full overflow-hidden px-4">
                <div
                    className="whitespace-nowrap animate-marquee-rtl inline-block"
                    style={{
                        animationDuration: `${Math.max(duplicatedText.length * 0.3, 40)}s`,
                        animationPlayState: isPaused ? 'paused' : 'running',
                        animationDelay: `-${Math.max(duplicatedText.length * 0.3, 40) / 2}s`, // Start halfway to show text immediately
                    }}
                    onPointerDown={() => setIsPaused(true)}
                    onPointerUp={() => setIsPaused(false)}
                    onPointerLeave={() => setIsPaused(false)}
                    onTouchStart={() => setIsPaused(true)}
                    onTouchEnd={() => setIsPaused(false)}
                >
                    <span className="font-bold text-base text-blue-100 drop-shadow-md font-tajawal mx-4">
                        {duplicatedText}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default TipsMarquee;
