import { useState, useEffect } from "react";
import { Login } from "./Login";
import { Smartphone, MonitorPlay, ChevronLeft, Download } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { ThemeToggleFloating } from "../components/ui/ThemeToggleFloating";

interface LauncherPageProps {
    onProceed?: () => void;
    initialShowLogin?: boolean;
}

export const LauncherPage = ({ onProceed, initialShowLogin = false }: LauncherPageProps) => {
    const { } = useAuth();
    const { theme } = useTheme();
    const [showLogin, setShowLogin] = useState(initialShowLogin);
    const [os, setOs] = useState<'android' | 'ios' | 'desktop'>('desktop');

    useEffect(() => {
        const ua = navigator.userAgent;
        if (/Android/i.test(ua)) setOs('android');
        else if (/iPhone|iPad|iPod/i.test(ua)) setOs('ios');
        else setOs('desktop');
    }, []);

    const handleWebProceed = () => {
        if (onProceed) onProceed();
        setShowLogin(true);
    };

    if (showLogin) {
        return <Login onBack={() => setShowLogin(false)} />;
    }

    return (
        <div className={`h-screen w-full flex flex-col relative overflow-y-auto overflow-x-hidden font-tajawal scroll-smooth transition-colors duration-500 ${
            theme === 'light' ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-slate-100'
        }`} dir="rtl">
            <ThemeToggleFloating />

            {/* Background elements - Fixed to prevent movement during scroll */}
            <div className={`fixed inset-0 z-0 bg-cover bg-center transition-opacity duration-1000 scale-105 ${
                theme === 'light' ? 'opacity-20' : 'opacity-40'
            }`}
                style={{ backgroundImage: `url('/sign-in.jpg')` }} />
            
            <div className={`fixed inset-0 z-0 transition-colors duration-700 ${
                theme === 'light' 
                    ? 'bg-gradient-to-b from-white/90 via-white/80 to-white' 
                    : 'bg-gradient-to-b from-slate-950/80 via-slate-950/60 to-slate-950'
            }`}></div>
            
            {/* Animated glows - Fixed */}
            <div className={`fixed top-0 right-0 w-96 h-96 rounded-full blur-[100px] pointer-events-none transition-colors duration-1000 ${
                theme === 'light' ? 'bg-emerald-200/40' : 'bg-emerald-500/20'
            }`}></div>
            <div className={`fixed bottom-0 left-0 w-96 h-96 rounded-full blur-[100px] pointer-events-none transition-colors duration-1000 ${
                theme === 'light' ? 'bg-blue-200/40' : 'bg-blue-500/20'
            }`}></div>

            {/* Header */}
            <div className="relative z-10 flex flex-col items-center pt-[calc(1rem+env(safe-area-inset-top))] md:pt-16 pb-2 animate-in fade-in slide-in-from-top-8 duration-1000">
                <div className={`w-16 h-16 md:w-24 md:h-24 rounded-full overflow-hidden border-2 shadow-xl mb-2 p-1 ${
                    theme === 'light' ? 'border-brand-green/20 bg-white shadow-gray-200' : 'border-emerald-500/50 bg-slate-900 shadow-[0_0_30px_rgba(34,197,94,0.3)]'
                }`}>
                     <img src="/icon-512.png" alt="المديرية" className="w-full h-full object-cover rounded-full" />
                </div>
                <h1 className={`text-xl md:text-4xl font-bold drop-shadow-md text-center px-4 leading-tight transition-colors duration-500 ${
                    theme === 'light' ? 'text-slate-900' : 'text-white'
                }`}>
                    مديرية الاتصالات ومعلوماتية<br className="md:hidden" /> كربلاء المقدسة
                </h1>
                <p className="text-brand-green mt-1 text-sm md:text-lg italic font-medium">نظام الإدارة الموحد</p>
                <div className="h-1.5 w-16 bg-brand-green rounded-full mt-2 shadow-lg" />
            </div>

            {/* Platform Selection */}
            <div className="relative z-10 w-full max-w-4xl mx-auto flex-1 flex flex-col items-center px-6 pb-20">
                <h2 className={`text-lg mb-6 text-center animate-in fade-in duration-1000 delay-150 transition-colors ${
                    theme === 'light' ? 'text-slate-600' : 'text-slate-300'
                }`}>
                    اختر المنصة المناسبة لجهازك
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
                    
                    {/* Android APK Button */}
                    <button 
                        onClick={() => {
                            const timestamp = new Date().getTime();
                            window.location.href = `https://raw.githubusercontent.com/muslim1972/InfTeleKarbala/main/public/app.apk?v=${timestamp}`;
                        }}
                        className={`group relative flex flex-col items-center gap-3 p-6 rounded-3xl border backdrop-blur-xl transition-all duration-300 cursor-pointer overflow-hidden
                            ${os === 'android' 
                                ? theme === 'light'
                                    ? 'bg-emerald-50 border-emerald-500/30'
                                    : 'bg-emerald-600/20 border-emerald-500/50 shadow-[0_0_40px_rgba(34,197,94,0.2)]' 
                                : theme === 'light'
                                    ? 'bg-white border-gray-200 shadow-sm'
                                    : 'bg-white/5 border-white/10'
                            }
                        `}
                    >
                        {os === 'android' && (
                            <div className="absolute top-0 right-0 bg-brand-green text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl">
                                يوصى به لجهازك
                            </div>
                        )}
                        <Download className={`w-8 h-8 ${theme === 'light' ? 'text-brand-green' : 'text-emerald-400'}`} />
                        <div className="text-center">
                            <h3 className={`text-lg font-bold mb-1 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>تطبيق أندرويد</h3>
                            <p className={`${theme === 'light' ? 'text-slate-500' : 'text-slate-400'} text-xs leading-relaxed`}>تثبيت التطبيق الأصلي للإشعارات والمكالمات المستقرة.</p>
                        </div>
                    </button>

                    {/* Desktop / iOS Web App Button */}
                    <button 
                        onClick={handleWebProceed}
                        className={`group relative flex flex-col items-center gap-3 p-6 rounded-3xl border backdrop-blur-xl transition-all duration-300 cursor-pointer overflow-hidden
                            ${os !== 'android' 
                                ? theme === 'light'
                                    ? 'bg-blue-50 border-blue-500/30'
                                    : 'bg-blue-600/20 border-blue-500/50 shadow-[0_0_40px_rgba(59,130,246,0.2)]' 
                                : theme === 'light'
                                    ? 'bg-white border-gray-200 shadow-sm'
                                    : 'bg-white/5 border-white/10'
                            }
                        `}
                    >
                        {os !== 'android' && (
                            <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl">
                                يوصى به لجهازك
                            </div>
                        )}
                        {os === 'ios' ? <Smartphone className={`w-8 h-8 ${theme === 'light' ? 'text-blue-600' : 'text-blue-400'}`} /> : <MonitorPlay className={`w-8 h-8 ${theme === 'light' ? 'text-blue-600' : 'text-blue-400'}`} />}
                        <div className="text-center">
                            <h3 className={`text-lg font-bold mb-1 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                                {os === 'ios' ? 'نسخة الويب (PWA)' : 'متصفح الكمبيوتر وهواتف iOS'}
                            </h3>
                            <p className={`${theme === 'light' ? 'text-slate-500' : 'text-slate-400'} text-xs leading-relaxed`}>انتقل مباشرة للتطبيق كاختصار لشاشتك الرئيسية.</p>
                        </div>
                    </button>
                </div>

            </div>
        </div>
    );
};
