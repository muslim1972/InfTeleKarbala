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
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setUrl(`https://band.khr-itpc.egov.iq/#access_token=${session.access_token}&refresh_token=${session.refresh_token}`);
            } else {
                // If no session, fallback to login
                setUrl('https://band.khr-itpc.egov.iq');
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
            <div className={`flex h-screen items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-slate-50'}`}>
                <Loader2 className="w-8 h-8 animate-spin text-brand-green" />
            </div>
        );
    }

    return (
        <div className={`flex flex-col h-screen w-full relative ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
            <iframe 
                src={url} 
                className="flex-1 w-full border-none"
                allow="camera; microphone; geolocation"
            />
        </div>
    );
};
