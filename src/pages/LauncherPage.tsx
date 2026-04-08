import { useState, useEffect } from "react";
import { Login } from "./Login";
import { Smartphone, MonitorPlay, ChevronLeft, Download } from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface LauncherPageProps {
    onProceed?: () => void;
    initialShowLogin?: boolean;
}

export const LauncherPage = ({ onProceed, initialShowLogin = false }: LauncherPageProps) => {
    const {} = useAuth();
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
        <div className="h-screen w-full flex flex-col relative overflow-y-auto overflow-x-hidden bg-slate-950 font-tajawal text-slate-100 scroll-smooth" dir="rtl">
            {/* Background elements - Fixed to prevent movement during scroll */}
            <div className="fixed inset-0 z-0 bg-cover bg-center opacity-40 scale-105"
                style={{ backgroundImage: `url('/sign-in.jpg')` }} />
            <div className="fixed inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/60 to-slate-950 z-0"></div>
            
            {/* Animated glows - Fixed */}
            <div className="fixed top-0 right-0 w-96 h-96 bg-emerald-500/20 rounded-full blur-[100px] pointer-events-none"></div>
            <div className="fixed bottom-0 left-0 w-96 h-96 bg-blue-500/20 rounded-full blur-[100px] pointer-events-none"></div>

            {/* Header */}
            <div className="relative z-10 flex flex-col items-center pt-[calc(1rem+env(safe-area-inset-top))] md:pt-16 pb-2 animate-in fade-in slide-in-from-top-8 duration-1000">
                <div className="w-16 h-16 md:w-24 md:h-24 rounded-full overflow-hidden border-2 border-emerald-500/50 shadow-[0_0_30px_rgba(34,197,94,0.3)] mb-2 bg-slate-900 p-1">
                     <img src="/icon-512.png" alt="المديرية" className="w-full h-full object-cover rounded-full" />
                </div>
                <h1 className="text-xl md:text-4xl font-bold text-white drop-shadow-md text-center px-4 leading-tight">
                    مديرية الاتصالات ومعلوماتية<br className="md:hidden" /> كربلاء المقدسة
                </h1>
                <p className="text-emerald-400 mt-1 text-sm md:text-lg italic">نظام الإدارة الموحد</p>
                <div className="h-1 w-12 bg-emerald-500 rounded-full mt-2" />
            </div>

            {/* Platform Selection */}
            <div className="relative z-10 w-full max-w-4xl mx-auto flex-1 flex flex-col items-center px-6 pb-20">
                <h2 className="text-lg text-slate-300 mb-6 text-center animate-in fade-in duration-1000 delay-150">
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
                                ? 'bg-emerald-600/20 border-emerald-500/50 shadow-[0_0_40px_rgba(34,197,94,0.2)]' 
                                : 'bg-white/5 border-white/10'
                            }
                        `}
                    >
                        {os === 'android' && (
                            <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl">
                                يوصى به لجهازك
                            </div>
                        )}
                        <Download className={`w-8 h-8 ${os === 'android' ? 'text-emerald-400' : 'text-slate-400'}`} />
                        <div className="text-center">
                            <h3 className="text-lg font-bold text-white mb-1">تطبيق أندرويد</h3>
                            <p className="text-slate-400 text-xs leading-relaxed">تثبيت التطبيق الأصلي للإشعارات والمكالمات المستقرة.</p>
                        </div>
                    </button>

                    {/* Desktop / iOS Web App Button */}
                    <button 
                        onClick={handleWebProceed}
                        className={`group relative flex flex-col items-center gap-3 p-6 rounded-3xl border backdrop-blur-xl transition-all duration-300 cursor-pointer overflow-hidden
                            ${os !== 'android' 
                                ? 'bg-blue-600/20 border-blue-500/50 shadow-[0_0_40px_rgba(59,130,246,0.2)]' 
                                : 'bg-white/5 border-white/10'
                            }
                        `}
                    >
                        {os !== 'android' && (
                            <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl">
                                يوصى به لجهازك
                            </div>
                        )}
                        {os === 'ios' ? <Smartphone className="w-8 h-8 text-blue-400" /> : <MonitorPlay className="w-8 h-8 text-blue-400" />}
                        <div className="text-center">
                            <h3 className="text-lg font-bold text-white mb-1">
                                {os === 'ios' ? 'نسخة الويب (PWA)' : 'متصفح الكمبيوتر'}
                            </h3>
                            <p className="text-slate-400 text-xs leading-relaxed">انتقل مباشرة للتطبيق كاختصار لشاشتك الرئيسية.</p>
                        </div>
                    </button>
                </div>

                {/* Legacy App Link */}
                <div className="mt-8 pt-4 border-t border-white/10 w-full max-w-sm flex items-center justify-center mb-8 shrink-0">
                    <a href="https://itpc-management-system.onrender.com/" className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors">
                        <span className="text-xs">الذهاب إلى "نظام قسم السعات"</span>
                        <ChevronLeft className="w-4 h-4" />
                    </a>
                </div>
            </div>
        </div>
    );
};
