import React from "react";
import { User, ShieldCheck, GraduationCap, Fingerprint, Briefcase } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { ThemeToggleFloating } from "../ui/ThemeToggleFloating";
import toast from 'react-hot-toast';
import { isDeveloperLevel } from "../../utils/permissions";

interface AdminRoleSelectorProps {
    onSelect: (role: 'admin' | 'user' | 'capacities' | 'promotion' | 'training' | 'user_incentives' | 'attendance' | 'hr') => void;
    /** Whether this user is eligible for the Capacities system */
    hasCapacities?: boolean;
    /** Whether this user is eligible for Promotion Courses */
    hasPromotion?: boolean;
    /** Whether this user is eligible for Summer Training */
    hasTraining?: boolean;
    /** Whether this user is eligible for HR */
    hasHR?: boolean;
}

export const AdminRoleSelector = ({ onSelect, hasCapacities = false, hasPromotion = false, hasTraining = false, hasHR = false }: AdminRoleSelectorProps) => {
    const { user, logout } = useAuth();
    const { theme } = useTheme();

    const isAdmin = user?.role === 'admin';
    const isDark = theme === 'dark';

    // Build cards list
    const cards: {
        id: 'user' | 'admin' | 'capacities' | 'promotion' | 'training' | 'user_incentives' | 'attendance' | 'hr';
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
            desc: 'الصلاحيات الشخصية ومتابعة السجلات',
            icon: <User className="w-5 h-5 text-brand-green" />,
            hoverGlow: 'hover:shadow-[0_0_30px_rgba(34,197,94,0.2)]',
            iconBg: isDark ? 'bg-brand-green/20 border-brand-green/30 group-hover:bg-brand-green/30' : 'bg-brand-green/10 border-brand-green/20',
            show: true,
        },
        {
            id: 'admin',
            label: 'مشرف',
            desc: 'لوحة الإدارة والتحكم بالنظام',
            icon: <ShieldCheck className="w-5 h-5 text-blue-500" />,
            hoverGlow: 'hover:shadow-[0_0_30px_rgba(59,130,246,0.2)]',
            iconBg: isDark ? 'bg-blue-500/20 border-blue-500/30 group-hover:bg-blue-500/30' : 'bg-blue-500/10 border-blue-500/20',
            show: isAdmin,
        },
        {
            id: 'capacities',
            label: 'قسم تجهيز خدمات المعلوماتية',
            desc: 'نظام إدارة السعات والاشتراكات',
            icon: <img src="/itpc-logo.png" alt="ITPC" className="w-6 h-6 object-contain drop-shadow-sm" />,
            hoverGlow: 'hover:shadow-[0_0_30px_rgba(168,85,247,0.2)]',
            iconBg: isDark ? 'bg-purple-500/20 border-purple-500/30 group-hover:bg-purple-500/30' : 'bg-purple-500/10 border-purple-500/20',
            show: hasCapacities,
        },
        {
            id: 'promotion',
            label: 'دورات الترفيع',
            desc: 'دراسة المناهج والاختبارات الإلكترونية',
            icon: <GraduationCap className="w-5 h-5 text-amber-500" />,
            hoverGlow: 'hover:shadow-[0_0_30px_rgba(245,158,11,0.2)]',
            iconBg: isDark ? 'bg-amber-500/20 border-amber-500/30 group-hover:bg-amber-500/30' : 'bg-amber-500/10 border-amber-500/20',
            show: hasPromotion,
        },
        {
            id: 'training',
            label: 'التدريب الصيفي',
            desc: 'شؤون المتدربين والاختبارات',
            icon: <GraduationCap className="w-5 h-5 text-emerald-500" />,
            hoverGlow: 'hover:shadow-[0_0_30px_rgba(16,185,129,0.2)]',
            iconBg: isDark ? 'bg-emerald-500/20 border-emerald-500/30 group-hover:bg-emerald-500/30' : 'bg-emerald-500/10 border-emerald-500/20',
            show: hasTraining,
        },
        {
            id: 'user_incentives',
            label: 'الحوافز الشهرية',
            desc: 'تقييم الحوافز واحتساب النقاط',
            icon: <img src="/icon-192.png" alt="Incentives" className="w-5 h-5 object-contain" />,
            hoverGlow: 'hover:shadow-[0_0_30px_rgba(34,197,94,0.2)]',
            iconBg: isDark ? 'bg-brand-green/20 border-brand-green/30 group-hover:bg-brand-green/30' : 'bg-brand-green/10 border-brand-green/20',
            show: true,
        },
        {
            id: 'attendance',
            label: 'الحضور والانصراف',
            desc: 'تسجيل الحضور والانصراف بيومترياً',
            icon: <Fingerprint className="w-5 h-5 text-cyan-500" />,
            hoverGlow: 'hover:shadow-[0_0_30px_rgba(6,182,212,0.2)]',
            iconBg: isDark ? 'bg-cyan-500/20 border-cyan-500/30 group-hover:bg-cyan-500/30' : 'bg-cyan-500/10 border-cyan-500/20',
            show: true,
        },
        {
            id: 'hr',
            label: 'الموارد البشرية',
            desc: 'الطلبات والكتب وإضبارات الموظفين',
            icon: <Briefcase className="w-5 h-5 text-rose-500" />,
            hoverGlow: 'hover:shadow-[0_0_30px_rgba(244,63,94,0.25)]',
            iconBg: isDark ? 'bg-rose-500/20 border-rose-500/30 group-hover:bg-rose-500/30' : 'bg-rose-500/10 border-rose-500/20',
            show: Boolean(hasHR),
        },
    ];

    const visibleCards = cards.filter(c => c.show);
    const isCompact = visibleCards.length > 4;

    const handleCardClick = (cardId: string) => {
        const isSupervisorOrDeveloper = isAdmin || isDeveloperLevel(user?.admin_role);
        const isSpecialAccount =
            user?.full_name?.includes('تجريبي 2') ||
            user?.full_name?.includes('مستخدم تجريبي') ||
            user?.username?.includes('تجريبي 2') ||
            user?.username?.includes('مستخدم تجريبي') ||
            user?.username === 'test2' ||
            user?.username === 'test' ||
            user?.full_name?.includes('مسلم عقيل') ||
            user?.full_name?.includes('مسلم قيل');

        if (cardId === 'attendance' || cardId === 'hr') {
            onSelect(cardId as any);
            return;
        }

        if (!isSupervisorOrDeveloper && !isSpecialAccount && ['promotion', 'user_incentives'].includes(cardId)) {
            toast('ستضاف هذه الميزة قريباً ... بإذن الله', { icon: '🚧' });
            return;
        }
        onSelect(cardId as any);
    };

    return (
        <div className={`min-h-screen w-full flex flex-col justify-center items-center relative font-tajawal transition-colors duration-500 overflow-x-hidden ${
            isDark ? 'bg-gray-900' : 'bg-slate-50'
        }`}>
            <ThemeToggleFloating />
            {/* Smart Background Layer - Fixed */}
            <div
                className={`fixed inset-0 z-0 bg-cover bg-center transition-all duration-1000 ease-in-out scale-105 pointer-events-none ${
                    isDark ? 'opacity-100' : 'opacity-20'
                }`}
                style={{ backgroundImage: `url('/sign-in.jpg')` }}
            >
                <div className={`absolute inset-0 backdrop-blur-sm transition-colors duration-700 ${
                    isDark ? 'bg-black/60' : 'bg-white/60'
                }`}></div>
            </div>

            {/* Main Content Container - Vertically Centered */}
            <div className={`relative z-10 w-full max-w-lg my-auto flex flex-col items-center justify-center transition-all duration-500 ${
                isCompact 
                    ? 'px-4 pt-16 pb-8 sm:py-10' 
                    : 'p-6 pt-20 pb-12 sm:py-12'
            }`}>

                <div className={`text-center animate-in fade-in slide-in-from-bottom-8 duration-700 ${
                    isCompact ? 'mb-4 space-y-1' : 'mb-6 space-y-2.5'
                }`}>
                    <h1 className={`font-bold font-tajawal drop-shadow-lg transition-colors duration-500 ${
                        isCompact ? 'text-xl sm:text-2xl leading-snug' : 'text-2xl sm:text-3xl leading-relaxed'
                    } ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        مرحباً بك، {user?.full_name}
                    </h1>
                    <p className={`italic transition-colors duration-500 ${
                        isCompact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'
                    } ${isDark ? 'text-white/80' : 'text-slate-700'}`}>
                        يرجى اختيار طريقة الدخول
                    </p>
                    <div className={`bg-brand-green mx-auto rounded-full shadow-lg ${
                        isCompact ? 'h-1 w-12 mt-1.5' : 'h-1.5 w-16 mt-2'
                    }`} />
                </div>

                {isCompact ? (
                    /* النمط الرشيق المدمج (Compact 2-Column Grid) للبطاقات الكثيرة (5 فأكثر) لمنع السكرول */
                    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 w-full animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-100">
                        {visibleCards.map(card => (
                            <button
                                key={card.id}
                                onClick={() => handleCardClick(card.id)}
                                className={`group relative flex flex-row items-center text-right p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] min-h-[68px] sm:min-h-[74px] ${
                                    isDark
                                        ? `bg-white/5 border-white/10 hover:bg-white/10 ${card.hoverGlow}`
                                        : 'bg-white/90 border-gray-200/90 shadow-md shadow-gray-200/40 hover:bg-white'
                                }`}
                            >
                                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex-shrink-0 flex items-center justify-center transition-colors border ${card.iconBg}`}>
                                    {card.icon}
                                </div>
                                <div className="flex-1 min-w-0 pr-2.5 sm:pr-3 text-right overflow-hidden">
                                    <h3 className={`text-xs sm:text-[13px] font-bold leading-tight truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                        {card.label}
                                    </h3>
                                    <p className={`text-[10px] sm:text-[11px] font-medium leading-snug line-clamp-1 sm:line-clamp-2 mt-0.5 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                                        {card.desc}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    /* النمط الكلاسيكي الواسع للبطاقات القليلة (1 إلى 4 بطاقات) */
                    <div className="grid grid-cols-2 gap-3.5 w-full animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-100">
                        {visibleCards.map(card => (
                            <button
                                key={card.id}
                                onClick={() => handleCardClick(card.id)}
                                className={`group relative flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${
                                    isDark
                                        ? `bg-white/5 border-white/10 hover:bg-white/10 ${card.hoverGlow}`
                                        : 'bg-white/80 border-gray-200 shadow-xl shadow-gray-200/50 hover:bg-white'
                                }`}
                            >
                                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-2.5 transition-colors border ${card.iconBg}`}>
                                    {card.icon}
                                </div>
                                <h3 className={`text-xs sm:text-sm font-bold mb-1 text-center leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                    {card.label}
                                </h3>
                                <p className={`text-[10px] sm:text-xs text-center leading-relaxed font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                                    {card.desc}
                                </p>
                            </button>
                        ))}
                    </div>
                )}

                {/* Logout Button in Top Left */}
                <div className="fixed top-[calc(1.25rem+env(safe-area-inset-top))] left-4 sm:left-6 z-[100] animate-in fade-in slide-in-from-top-8 duration-700">
                    <button
                        onClick={() => {
                            if (window.confirm("هل أنت متأكد من تسجيل الخروج؟")) {
                                logout();
                            }
                        }}
                        className={`flex items-center justify-center h-10 sm:h-11 px-3 sm:px-4 gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl transition-all duration-500 group shadow-lg backdrop-blur-xl border active:scale-90 ${
                            isDark 
                                ? 'bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/40' 
                                : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                        }`}
                        title="تسجيل الخروج"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-500 group-hover:rotate-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span className="font-bold text-xs sm:text-sm font-tajawal">تسجيل الخروج</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
