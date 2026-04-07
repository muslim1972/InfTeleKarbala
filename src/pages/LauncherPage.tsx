import { useState, useEffect } from "react";
import { Login } from "./Login";
import { Smartphone, MonitorPlay, ChevronLeft, Download } from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface LauncherPageProps {
    onProceed?: () => void;
}

export const LauncherPage = ({ onProceed }: LauncherPageProps) => {
    const { user } = useAuth();
    const [showLogin, setShowLogin] = useState(false);
    const [os, setOs] = useState<'android' | 'ios' | 'desktop'>('desktop');

    useEffect(() => {
        const ua = navigator.userAgent;
        if (/Android/i.test(ua)) setOs('android');
        else if (/iPhone|iPad|iPod/i.test(ua)) setOs('ios');
        else setOs('desktop');
    }, []);

    const handleWebProceed = () => {
        if (onProceed) {
            onProceed();
        } else {
            setShowLogin(true);
        }
    };

    if (showLogin) {
        return <Login onBack={() => setShowLogin(false)} />;
    }

    return (
        <div className="min-h-screen w-full flex flex-col relative overflow-hidden bg-slate-950 font-tajawal text-slate-100" dir="rtl">
            {/* Background elements */}
            <div className="absolute inset-0 z-0 bg-cover bg-center opacity-40 scale-105"
                style={{ backgroundImage: `url('/sign-in.jpg')` }} />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/60 to-slate-950 z-0"></div>
            
            {/* Animated glows */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/20 rounded-full blur-[100px] pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/20 rounded-full blur-[100px] pointer-events-none"></div>

            {/* Header */}
            <div className="relative z-10 flex flex-col items-center pt-16 pb-8 animate-in fade-in slide-in-from-top-8 duration-1000">
                <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-emerald-500/50 shadow-[0_0_30px_rgba(34,197,94,0.3)] mb-4 bg-slate-900 p-1">
                     <img src="/icon-512.png" alt="المديرية" className="w-full h-full object-cover rounded-full" />
                </div>
                <h1 className="text-3xl md:text-4xl font-bold text-white drop-shadow-md text-center px-4 leading-tight">
                    مديرية الاتصالات ومعلوماتية<br className="md:hidden" /> كربلاء المقدسة
                </h1>
                <p className="text-emerald-400 mt-2 text-lg">نظام الإدارة الموحد</p>
                <div className="h-1 w-16 bg-emerald-500 rounded-full mt-4" />
            </div>

            {/* Platform Selection */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-12 w-full max-w-4xl mx-auto">
                <h2 className="text-xl text-slate-300 mb-8 text-center animate-in fade-in duration-1000 delay-150">
                    اختر المنصة المناسبة لجهازك للحصول على أفضل تجربة
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
                    
                    {/* Android APK Button */}
                    <button 
                        onClick={() => {
                            // التنزيل من السورس الخاص بـ Github مباشرة لتجاوز ذاكرة الكاش في Vercel (Cache-Busting)
                            const timestamp = new Date().getTime();
                            window.location.href = `https://raw.githubusercontent.com/muslim1972/InfTeleKarbala/main/public/app.apk?v=${timestamp}`;
                        }}
                        className={`group relative flex flex-col items-center gap-4 p-8 rounded-3xl border backdrop-blur-xl transition-all duration-300 cursor-pointer overflow-hidden
                            ${os === 'android' 
                                ? 'bg-emerald-600/20 border-emerald-500/50 shadow-[0_0_40px_rgba(34,197,94,0.2)] hover:bg-emerald-600/30 hover:border-emerald-400' 
                                : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-emerald-500/30'
                            }
                        `}
                    >
                        {os === 'android' && (
                            <div className="absolute top-0 right-0 bg-emerald-500 text-white text-xs font-bold px-4 py-1 rounded-bl-xl shadow-lg">
                                يوصى به لجهازك
                            </div>
                        )}
                        <div className={`p-4 rounded-full ${os === 'android' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400 group-hover:text-emerald-400 group-hover:bg-emerald-500/10'} transition-colors`}>
                            <Download className="w-10 h-10" />
                        </div>
                        <div className="text-center">
                            <h3 className="text-2xl font-bold text-white mb-2">تطبيق أندرويد</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                قم بتثبيت التطبيق الأصلي (Native APK) لضمان عمل الإشعارات والمكالمات في الخلفية بكفاءة تامة.
                            </p>
                        </div>
                        <div className={`mt-2 flex items-center text-sm font-bold ${os === 'android' ? 'text-emerald-400' : 'text-slate-500 group-hover:text-emerald-400'}`}>
                            تحميل الآن <ChevronLeft className="w-4 h-4 mr-1" />
                        </div>
                    </button>

                    {/* Desktop / iOS Web App Button */}
                    <button 
                        onClick={handleWebProceed}
                        className={`group relative flex flex-col items-center gap-4 p-8 rounded-3xl border backdrop-blur-xl transition-all duration-300 cursor-pointer overflow-hidden
                            ${os !== 'android' 
                                ? 'bg-blue-600/20 border-blue-500/50 shadow-[0_0_40px_rgba(59,130,246,0.2)] hover:bg-blue-600/30 hover:border-blue-400' 
                                : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-blue-500/30'
                            }
                        `}
                    >
                        {os !== 'android' && (
                            <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs font-bold px-4 py-1 rounded-bl-xl shadow-lg">
                                يوصى به لجهازك
                            </div>
                        )}
                        
                        <div className={`p-4 rounded-full ${os !== 'android' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-400 group-hover:text-blue-400 group-hover:bg-blue-500/10'} transition-colors`}>
                            {os === 'ios' ? <Smartphone className="w-10 h-10" /> : <MonitorPlay className="w-10 h-10" />}
                        </div>
                        <div className="text-center">
                            <h3 className="text-2xl font-bold text-white mb-2">
                                {os === 'ios' ? 'نسخة الويب (PWA)' : 'متصفح الكمبيوتر'}
                            </h3>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                انتقل مباشرة إلى التطبيق. يمكنك لاحقاً إضافته كاختصار إلى شاشتك الرئيسية لسهولة الوصول.
                            </p>
                        </div>
                        <div className={`mt-2 flex items-center text-sm font-bold ${os !== 'android' ? 'text-blue-400' : 'text-slate-500 group-hover:text-blue-400'}`}>
                            {user ? 'الاستمرار إلى لوحة التحكم' : 'الدخول للتطبيق'} <ChevronLeft className="w-4 h-4 mr-1" />
                        </div>
                    </button>

                </div>

                {/* Legacy App Link */}
                <div className="mt-12 pt-6 border-t border-white/10 w-full max-w-sm flex items-center justify-center animate-in fade-in duration-1000 delay-500">
                    <a 
                        href="https://itpc-management-system.onrender.com/"
                        className="flex items-center gap-3 text-slate-400 hover:text-white transition-colors duration-300 group"
                    >
                        <div className="w-8 h-8 rounded-full overflow-hidden border border-white/20 group-hover:border-blue-500 transition-colors bg-white">
                            <img src="/Logo-Int-Karbala.jpeg" alt="نظام قسم السعات" className="w-full h-full object-cover" />
                        </div>
                        <span className="text-sm font-medium">الذهاب إلى "نظام قسم السعات"</span>
                        <ChevronLeft className="w-4 h-4 -ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                </div>
            </div>
        </div>
    );
};
