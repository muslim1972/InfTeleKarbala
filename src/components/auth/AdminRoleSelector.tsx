import { User, ShieldCheck, GraduationCap } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { AppFooter } from "../layout/AppFooter";
import { useTheme } from "../../context/ThemeContext";
import { ThemeToggleFloating } from "../ui/ThemeToggleFloating";

interface AdminRoleSelectorProps {
    onSelect: (role: 'admin' | 'user' | 'capacities' | 'promotion') => void;
    /** Whether this user is eligible for the Capacities system */
    hasCapacities?: boolean;
    /** Whether this user is eligible for Promotion Courses */
    hasPromotion?: boolean;
}

export const AdminRoleSelector = ({ onSelect, hasCapacities = false, hasPromotion = false }: AdminRoleSelectorProps) => {
    const { user } = useAuth();
    const { theme } = useTheme();

    const isAdmin = user?.role === 'admin';
    const isDark = theme === 'dark';

    // Build cards list
    const cards: {
        id: 'user' | 'admin' | 'capacities' | 'promotion';
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
            <div className="relative z-10 w-full max-w-lg p-6 flex flex-col items-center pt-[calc(3rem+env(safe-area-inset-top))] pb-40">

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

                <div className="grid grid-cols-2 gap-3 w-full animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-100">
                    {visibleCards.map(card => (
                        <button
                            key={card.id}
                            onClick={() => onSelect(card.id)}
                            className={`group relative flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${
                                isDark
                                    ? `bg-white/5 border-white/10 hover:bg-white/10 ${card.hoverGlow}`
                                    : 'bg-white/80 border-gray-200 shadow-xl shadow-gray-200/50 hover:bg-white'
                            }`}
                        >
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors border ${card.iconBg}`}>
                                {card.icon}
                            </div>
                            <h3 className={`text-sm font-bold mb-1 text-center leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                {card.label}
                            </h3>
                            <p className={`text-[10px] text-center leading-relaxed ${isDark ? 'text-white/60' : 'text-slate-500'}`}>
                                {card.desc}
                            </p>
                        </button>
                    ))}
                </div>
            </div>

            {/* Footer */}
            <div className="absolute bottom-0 left-0 right-0 z-20">
                <AppFooter />
            </div>
        </div>
    );
};
