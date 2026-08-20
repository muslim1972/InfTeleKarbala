import { useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Loader2 } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';

export const CapacitiesIframe = ({ onBack }: { onBack: () => void }) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    useEffect(() => {
        const redirectToCapacities = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.access_token && session?.refresh_token) {
                    window.location.href = `https://band.khr-itpc.egov.iq/#access_token=${session.access_token}&refresh_token=${session.refresh_token}`;
                } else {
                    window.location.href = 'https://band.khr-itpc.egov.iq';
                }
            } catch (err) {
                console.error('Error redirecting to capacities:', err);
                window.location.href = 'https://band.khr-itpc.egov.iq';
            }
        };
        redirectToCapacities();
    }, []);

    return (
        <div className={`flex flex-col h-screen items-center justify-center gap-4 ${isDark ? 'bg-gray-900 text-white' : 'bg-slate-50 text-slate-800'}`}>
            <Loader2 className="w-10 h-10 animate-spin text-brand-green" />
            <p className="text-base font-tajawal font-medium">جاري الانتقال إلى نظام قسم تجهيز خدمات المعلوماتية...</p>
            <button 
                onClick={onBack}
                className="mt-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline font-tajawal transition-colors"
            >
                إلغاء والعودة
            </button>
        </div>
    );
};
