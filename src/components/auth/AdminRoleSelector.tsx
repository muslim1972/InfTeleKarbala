import React from "react";
import { User, ShieldCheck, Fingerprint, Briefcase } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { ThemeToggleFloating } from "../ui/ThemeToggleFloating";
import { isDeveloperLevel } from "../../utils/permissions";

interface AdminRoleSelectorProps {
    onSelect: (role: 'admin' | 'user' | 'capacities' | 'attendance' | 'hr') => void;
    /** Whether this user is eligible for the Capacities system */
    hasCapacities?: boolean;
    /** Whether this user is eligible for HR */
    hasHR?: boolean;
}

export const AdminRoleSelector = ({ onSelect, hasCapacities = false, hasHR = false }: AdminRoleSelectorProps) => {
    const { user, logout } = useAuth();
    const { theme } = useTheme();

    const isAdmin = user?.role === 'admin';
    const isDark = theme === 'dark';

    const isBiometricOnly = Boolean(
        (user?.admin_role === 'biometric' || user?.admin_role === 'attendance_supervisor' || user?.username === 'attend') &&
        user?.admin_role !== 'general' &&
        !isDeveloperLevel(user?.admin_role)
    );

    // البطاقات الإدارية والوظيفية (تم نقل التدريب والترفيع للوحة المشرف والحوافز للوحة المستخدم)
    const cards: {
        id: 'user' | 'admin' | 'capacities' | 'hr';
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
            show: isAdmin && !isBiometricOnly,
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
    const isOddCount = visibleCards.length % 2 === 1;

    return (
        <div className={`min-h-screen w-full flex flex-col items-center justify-between relative font-tajawal transition-colors duration-500 overflow-x-hidden ${
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

            {/* 1. Greeting Header - Fixed at Top, independent from card centering */}
            <div className="relative z-10 w-full max-w-lg text-center pt-[calc(4.75rem+env(safe-area-inset-top))] sm:pt-16 px-4 animate-in fade-in slide-in-from-top-6 duration-700 space-y-1.5">
                <h1 className={`font-bold font-tajawal drop-shadow-lg transition-colors duration-500 text-xl sm:text-2xl leading-snug ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    مرحباً بك، {user?.full_name}
                </h1>
                <p className={`italic transition-colors duration-500 text-xs sm:text-sm ${isDark ? 'text-white/80' : 'text-slate-700'}`}>
                    يرجى اختيار طريقة الدخول
                </p>
                <div className="bg-brand-green mx-auto rounded-full shadow-lg h-1 w-12 mt-1.5" />
            </div>

            {/* 2. Cards Container + Biometric Thumbprint Sensor below */}
            <div className="relative z-10 w-full max-w-lg flex-1 flex flex-col items-center justify-center px-4 py-3 pb-[calc(7.25rem+env(safe-area-inset-bottom,0px))] md:pb-[calc(8rem+env(safe-area-inset-bottom,0px))]">
                {/* شبكة البطاقات الرشيقة المتوازنة (مع تمديد البطاقة الأخيرة الفردية بعرض الصف) */}
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3 w-full animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-100">
                    {visibleCards.map((card, index) => {
                        const isLastOdd = isOddCount && index === visibleCards.length - 1;
                        return (
                            <button
                                key={card.id}
                                onClick={() => onSelect(card.id)}
                                className={`group relative flex flex-row items-center text-right p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] min-h-[66px] sm:min-h-[72px] ${
                                    isLastOdd ? 'col-span-2' : ''
                                } ${
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
                        );
                    })}
                </div>

                {/* مستشعر البصمة البيومتري التفاعلي في المنتصف أسفل البطاقات (الحضور والانصراف) */}
                <div className="mt-6 sm:mt-8 flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-1000 delay-200">
                    <button
                        type="button"
                        onClick={() => onSelect('attendance')}
                        aria-label="تسجيل الحضور والانصراف بالبصمة"
                        className="group relative flex flex-col items-center justify-center focus:outline-none select-none"
                    >
                        {/* هالة الوميض البطيء الخارجي */}
                        <span className="absolute -inset-3 rounded-full bg-cyan-500/15 dark:bg-cyan-400/15 blur-md animate-[pulse_3s_ease-in-out_infinite] pointer-events-none" />
                        <span className="absolute -inset-1.5 rounded-full border border-cyan-500/30 dark:border-cyan-400/30 animate-[ping_3.5s_cubic-bezier(0,0,0.2,1)_infinite] opacity-40 pointer-events-none" />

                        {/* إطار البصمة الإبهامي البيضوي التفاعلي */}
                        <div className={`relative w-[76px] h-[94px] sm:w-[84px] sm:h-[104px] rounded-[42px] flex items-center justify-center border-2 transition-all duration-300 group-hover:scale-105 group-active:scale-95 backdrop-blur-md ${
                            isDark
                                ? 'bg-cyan-950/40 border-cyan-400/50 shadow-[0_0_28px_rgba(34,211,238,0.22)] group-hover:border-cyan-300 group-hover:shadow-[0_0_36px_rgba(34,211,238,0.4)]'
                                : 'bg-white/90 border-cyan-500/50 shadow-[0_8px_28px_rgba(6,182,212,0.2)] group-hover:border-cyan-600 group-hover:shadow-[0_10px_35px_rgba(6,182,212,0.35)]'
                        }`}>
                            <Fingerprint
                                strokeWidth={1.6}
                                className={`w-12 h-14 sm:w-14 sm:h-16 animate-[pulse_2.8s_ease-in-out_infinite] transition-colors duration-300 ${
                                    isDark
                                        ? 'text-cyan-300 drop-shadow-[0_0_10px_rgba(34,211,238,0.6)] group-hover:text-cyan-200'
                                        : 'text-cyan-600 drop-shadow-[0_2px_8px_rgba(6,182,212,0.35)] group-hover:text-cyan-700'
                                }`}
                            />
                        </div>

                        {/* مسمى الحضور والانصراف بخط رشيق */}
                        <span className={`mt-2.5 text-xs sm:text-sm font-bold tracking-tight transition-colors ${
                            isDark ? 'text-cyan-200 group-hover:text-white' : 'text-slate-800 group-hover:text-cyan-700'
                        }`}>
                            الحضور والانصراف
                        </span>
                        <span className={`text-[10px] font-medium mt-0.5 ${
                            isDark ? 'text-cyan-400/75' : 'text-cyan-700/80'
                        }`}>
                            المس البصمة للدخول
                        </span>
                    </button>
                </div>

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
