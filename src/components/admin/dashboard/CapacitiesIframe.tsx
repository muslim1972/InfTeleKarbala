import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Loader2 } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';

export const CapacitiesIframe = ({ onBack }: { onBack: () => void }) => {
    const [url, setUrl] = useState<string | null>(null);
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    useEffect(() => {
        const getSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.access_token && session?.refresh_token) {
                    setUrl(`/band/#access_token=${session.access_token}&refresh_token=${session.refresh_token}`);
                } else {
                    setUrl('/band/');
                }
            } catch (err) {
                console.error('Error getting session for capacities iframe:', err);
                setUrl('/band/');
            }
        };
        getSession();

        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'BACK_TO_DASHBOARD') {
                if (event.data?.message) {
                    alert(event.data.message);
                }
                onBack();
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [onBack]);

    if (!url) {
        return (
            <div className={`flex flex-col h-screen items-center justify-center gap-4 ${isDark ? 'bg-gray-900 text-white' : 'bg-slate-50 text-slate-800'}`}>
                <Loader2 className="w-10 h-10 animate-spin text-brand-green" />
                <p className="text-base font-tajawal font-medium">جاري فتح نظام قسم تجهيز خدمات المعلوماتية...</p>
                <button 
                    onClick={onBack}
                    className="mt-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline font-tajawal transition-colors"
                >
                    إلغاء والعودة
                </button>
            </div>
        );
    }

    return (
        <div className={`flex flex-col h-screen w-full relative ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
            <iframe 
                src={url} 
                className="flex-1 w-full h-full border-none"
                allow="camera; microphone; geolocation"
            />
        </div>
    );
};
