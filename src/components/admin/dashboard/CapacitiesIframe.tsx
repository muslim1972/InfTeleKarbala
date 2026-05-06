import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Loader2, ArrowRight } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';

export const CapacitiesIframe = ({ onBack }: { onBack: () => void }) => {
    const [url, setUrl] = useState<string | null>(null);
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    useEffect(() => {
        const getSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setUrl(`https://itpc-band.vercel.app/#access_token=${session.access_token}&refresh_token=${session.refresh_token}`);
            } else {
                // If no session, fallback to login
                setUrl('https://itpc-band.vercel.app');
            }
        };
        getSession();
    }, []);

    if (!url) {
        return (
            <div className={`flex h-screen items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-slate-50'}`}>
                <Loader2 className="w-8 h-8 animate-spin text-brand-green" />
            </div>
        );
    }

    return (
        <div className={`flex flex-col h-screen w-full relative ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
            <div className={`p-4 flex items-center justify-between shadow-sm z-10 ${isDark ? 'bg-gray-800 border-b border-gray-700' : 'bg-white border-b border-gray-200'}`}>
                <button 
                    onClick={onBack}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all hover:scale-105 active:scale-95 ${
                        isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                    }`}
                >
                    <ArrowRight className="w-5 h-5" />
                    <span className="font-tajawal text-sm md:text-base">رجوع للوحة التحكم</span>
                </button>
                <div className="flex items-center gap-3">
                    <img src="/itpc-logo.png" alt="ITPC" className="w-8 h-8 object-contain" />
                    <h1 className={`hidden md:block font-bold font-tajawal text-lg ${isDark ? 'text-white' : 'text-gray-800'}`}>
                        قسم تجهيز خدمات المعلوماتية
                    </h1>
                </div>
            </div>
            <iframe 
                src={url} 
                className="flex-1 w-full border-none"
                allow="camera; microphone; geolocation"
            />
        </div>
    );
};
