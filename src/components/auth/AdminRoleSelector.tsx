import { User, ShieldCheck, GraduationCap, Fingerprint } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { AppFooter } from "../layout/AppFooter";
import { useTheme } from "../../context/ThemeContext";
import { ThemeToggleFloating } from "../ui/ThemeToggleFloating";

interface AdminRoleSelectorProps {
    onSelect: (role: 'admin' | 'user' | 'capacities' | 'promotion' | 'training' | 'user_incentives' | 'attendance') => void;
    /** Whether this user is eligible for the Capacities system */
    hasCapacities?: boolean;
    /** Whether this user is eligible for Promotion Courses */
    hasPromotion?: boolean;
    /** Whether this user is eligible for Summer Training */
    hasTraining?: boolean;
}

export const AdminRoleSelector = ({ onSelect, hasCapacities = false, hasPromotion = false, hasTraining = false }: AdminRoleSelectorProps) => {
    const { user, logout } = useAuth();
    const { theme } = useTheme();

    const isAdmin = user?.role === 'admin';
    const isDark = theme === 'dark';

    // Build cards list
    const cards: {
        id: 'user' | 'admin' | 'capacities' | 'promotion' | 'training' | 'user_incentives' | 'attendance';
        label: string;
        desc: string;
        icon: React.ReactNode;
        hoverGlow: string;
        iconBg: string;
        show: boolean;
    }[] = [
        {
            id: 'user',
            label: 'مستخدم',
            desc: 'الدخول للصلاحيات الشخصية ومتابعة السجلات',
            icon: <User className="w-6 h-6 text-brand-green" />,
            hoverGlow: 'hover:shadow-[0_0_30px_rgba(34,197,94,0.2)]',
            iconBg: isDark ? 'bg-brand-green/20 border-brand-green/30 group-hover:bg-brand-green/30' : 'bg-brand-green/10 border-brand-green/20',
            show: true,
        },
        {
            id: 'admin',
            label: 'مشرف',
            desc: 'الدخول للوحة الإدارة والتحكم بالنظام',
            icon: <ShieldCheck className="w-6 h-6 text-blue-500" />,
            hoverGlow: 'hover:shadow-[0_0_30px_rgba(59,130,246,0.2)]',
            iconBg: isDark ? 'bg-blue-500/20 border-blue-500/30 group-hover:bg-blue-500/30' : 'bg-blue-500/10 border-blue-500/20',
            show: isAdmin,
        },
        {
            id: 'capacities',
            label: 'قسم تجهيز خدمات المعلوماتية',
            desc: 'الدخول لنظام إدارة السعات والاشتراكات',
            icon: <img src="/itpc-logo.png" alt="ITPC" className="w-8 h-8 object-contain drop-shadow-sm" />,
            hoverGlow: 'hover:shadow-[0_0_30px_rgba(168,85,247,0.2)]',
            iconBg: isDark ? 'bg-purple-500/20 border-purple-500/30 group-hover:bg-purple-500/30' : 'bg-purple-500/10 border-purple-500/20',
            show: hasCapacities,
        },
        {
            id: 'promotion',
            label: 'دورات الترفيع',
            desc: 'دراسة المناهج وأداء الاختبارات الإلكترونية',
            icon: <GraduationCap className="w-6 h-6 text-amber-500" />,
            hoverGlow: 'hover:shadow-[0_0_30px_rgba(245,158,11,0.2)]',
            iconBg: isDark ? 'bg-amber-500/20 border-amber-500/30 group-hover:bg-amber-500/30' : 'bg-amber-500/10 border-amber-500/20',
            show: hasPromotion,
        },
        {
            id: 'training',
            label: 'التدريب الصيفي',
            desc: 'إدارة شؤون المتدربين والاختبارات',
            icon: <GraduationCap className="w-6 h-6 text-emerald-500" />,
            hoverGlow: 'hover:shadow-[0_0_30px_rgba(16,185,129,0.2)]',
            iconBg: isDark ? 'bg-emerald-500/20 border-emerald-500/30 group-hover:bg-emerald-500/30' : 'bg-emerald-500/10 border-emerald-500/20',
            show: hasTraining,
        },
        {
            id: 'user_incentives',
            label: 'الحوافز الشهرية',
            desc: 'عرض تقييم الحوافز واحتساب النقاط الشهرية',
            icon: <img src="/icon-192.png" alt="Incentives" className="w-6 h-6 object-contain" />,
            hoverGlow: 'hover:shadow-[0_0_30px_rgba(34,197,94,0.2)]',
            iconBg: isDark ? 'bg-brand-green/20 border-brand-green/30 group-hover:bg-brand-green/30' : 'bg-brand-green/10 border-brand-green/20',
            show: true,
        },
        {
            id: 'attendance',
            label: 'الحضور والانصراف',
            desc: 'تسجيل الحضور والإنصراف اليومي بيوميترياً وبالموقع الجغرافي',
            icon: <Fingerprint className="w-6 h-6 text-cyan-500" />,
            hoverGlow: 'hover:shadow-[0_0_30px_rgba(6,182,212,0.2)]',
            iconBg: isDark ? 'bg-cyan-500/20 border-cyan-500/30 group-hover:bg-cyan-500/30' : 'bg-cyan-500/10 border-cyan-500/20',
            show: true,
        },
    ];

    const visibleCards = cards.filter(c => c.show);

    return (
        <div className={`h-screen w-full flex items-start justify-center relative overflow-y-auto overflow-x-hidden font-tao scroll-smooth transition-colors duration-500 ${
            isDark ? 'bg-gray-900' : 'bg-slate-50'
        }`}>
            <ThemeToggleFloating />
            {/* Smart Background Layer - Fixed */}
            <div
                className={`fixed inset-0 z-0 bg-cover bg-center transition-all duration-1000 ease-in-out scale-105 ${
                    isDark ? 'opacity-100' : 'opacity-20'
                }`}
                style={{ backgroundImage: `url('/sign-in.jpg')` }}
            >
                <div className={`absolute inset-0 backdrop-blur-sm transition-colors duration-700 ${
                    isDark ? 'bg-black/60' : 'bg-white/60'
                }`}></div>
            </div>

            {/* Main Content Container */}
            <div className="relative z-10 w-full max-w-lg p-6 flex flex-col items-center pt-[calc(5.5rem+env(safe-area-inset-top))] pb-32">

                <div className="text-center mb-6 space-y-3 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <h1 className={`text-2xl md:text-3xl font-bold font-tajawal drop-shadow-lg leading-relaxed transition-colors duration-500 ${
                        isDark ? 'text-white' : 'text-slate-900'
                    }`}>
                        مرحباً بك، {user?.full_name}
                    </h1>
                    <p className={`text-base italic transition-colors duration-500 ${
                        isDark ? 'text-white/80' : 'text-slate-600'
                    }`}>
                        يرجى اختيار طريقة الدخول
                    </p>
                    <div className="h-1.5 w-16 bg-brand-green mx-auto rounded-full mt-2 shadow-lg" />
                </div>

                <div className="grid grid-cols-2 gap-3 w-full animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-100 mb-8">
                    {visibleCards.map(card => (
                        <button
                            key={card.id}
                            onClick={() => onSelect(card.id)}
                            className={`group relative flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${
                                isDark
                                    ? `bg-white/5 border-white/10 hover:bg-white/10 ${card.hoverGlow}`
                                    : 'bg-white/80 border-gray-200 shadow-xl shadow-gray-200/50 hover:bg-white'
                            }`}
                        >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-colors border ${card.iconBg}`}>
                                {card.icon}
                            </div>
                            <h3 className={`text-xs font-bold mb-1 text-center leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                {card.label}
                            </h3>
                            <p className={`text-[9px] text-center leading-relaxed ${isDark ? 'text-white/60' : 'text-slate-500'}`}>
                                {card.desc}
                            </p>
                        </button>
                    ))}
                </div>

                {/* Logout Button moved to top */}
                <div className="fixed top-[calc(1.5rem+env(safe-area-inset-top))] left-6 z-[100] animate-in fade-in slide-in-from-top-8 duration-700">
                    <button
                        onClick={() => {
                            if (window.confirm("هل أنت متأكد من تسجيل الخروج؟")) {
                                logout();
                            }
                        }}
                        className={`flex items-center justify-center h-12 px-4 gap-2 rounded-2xl transition-all duration-500 group shadow-lg backdrop-blur-xl border active:scale-90 ${
                            isDark 
                                ? 'bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/40' 
                                : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                        }`}
                        title="تسجيل الخروج"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 transition-transform duration-500 group-hover:rotate-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span className="font-bold text-sm font-tajawal">تسجيل الخروج</span>
                    </button>
                </div>
            </div>

            {/* Footer */}
            <div className="absolute bottom-0 left-0 right-0 z-20">
                <AppFooter />
            </div>
        </div>
    );
};
