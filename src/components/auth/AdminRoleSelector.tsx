import { User, ShieldCheck, BarChart3 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { AppFooter } from "../layout/AppFooter";
import { useTheme } from "../../context/ThemeContext";
import { ThemeToggleFloating } from "../ui/ThemeToggleFloating";

interface AdminRoleSelectorProps {
    onSelect: (role: 'admin' | 'user') => void;
    /** Whether this user is eligible for the Capacities system */
    hasCapacities?: boolean;
}

/** External URL for the ITPC Capacities Management System */
const CAPACITIES_URL = "https://itpc-management-system.onrender.com";

export const AdminRoleSelector = ({ onSelect, hasCapacities = false }: AdminRoleSelectorProps) => {
    const { user } = useAuth();
    const { theme } = useTheme();

    const handleCapacitiesClick = () => {
        // فتح في نفس النافذة مع علامة المصدر — Int-Karbala سيعيد التوجيه عند الخروج
        window.location.href = CAPACITIES_URL + '?from=inftele';
    };

    // Determine if admin card should appear (only if user is actually admin, not just capacities)
    const isAdmin = user?.role === 'admin';

    return (
        <div className={`h-screen w-full flex items-start justify-center relative overflow-y-auto overflow-x-hidden font-tao scroll-smooth transition-colors duration-500 ${
            theme === 'light' ? 'bg-slate-50' : 'bg-gray-900'
        }`}>
            <ThemeToggleFloating />
            {/* Smart Background Layer - Fixed */}
            <div
                className={`fixed inset-0 z-0 bg-cover bg-center transition-all duration-1000 ease-in-out scale-105 ${
                    theme === 'light' ? 'opacity-20' : 'opacity-100'
                }`}
                style={{ backgroundImage: `url('/sign-in.jpg')` }}
            >
                {/* Overlay */}
                <div className={`absolute inset-0 backdrop-blur-sm transition-colors duration-700 ${
                    theme === 'light' ? 'bg-white/60' : 'bg-black/60'
                }`}></div>
            </div>

            {/* Main Content Container */}
            <div className="relative z-10 w-full max-w-lg p-6 flex flex-col items-center pt-[calc(3rem+env(safe-area-inset-top))] pb-40">

                <div className="text-center mb-6 space-y-3 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <h1 className={`text-2xl md:text-3xl font-bold font-tajawal drop-shadow-lg leading-relaxed transition-colors duration-500 ${
                        theme === 'light' ? 'text-slate-900' : 'text-white'
                    }`}>
                        مرحباً بك، {user?.full_name}
                    </h1>
                    <p className={`text-base italic transition-colors duration-500 ${
                        theme === 'light' ? 'text-slate-600' : 'text-white/80'
                    }`}>
                        يرجى اختيار طريقة الدخول
                    </p>
                    <div className="h-1.5 w-16 bg-brand-green mx-auto rounded-full mt-2 shadow-lg" />
                </div>

                <div className={`grid grid-cols-1 ${isAdmin && hasCapacities ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4 w-full animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-100`}>
                    {/* User Role Button */}
                    <button
                        onClick={() => onSelect('user')}
                        className={`group relative flex flex-col items-center justify-center p-6 rounded-3xl border transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${
                            theme === 'light'
                                ? 'bg-white/80 border-gray-200 shadow-xl shadow-gray-200/50 hover:bg-white'
                                : 'bg-white/5 border-white/10 hover:bg-white/10 hover:shadow-[0_0_30px_rgba(34,197,94,0.2)]'
                        }`}
                    >
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors border ${
                            theme === 'light'
                                ? 'bg-brand-green/10 border-brand-green/20'
                                : 'bg-brand-green/20 border-brand-green/30 group-hover:bg-brand-green/30'
                        }`}>
                            <User className="w-8 h-8 text-brand-green" />
                        </div>
                        <h3 className={`text-lg font-bold mb-2 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>مستخدم</h3>
                        <p className={`text-xs text-center leading-relaxed ${theme === 'light' ? 'text-slate-500' : 'text-white/60'}`}>
                            الدخول للصلاحيات الشخصية ومتابعة السجلات
                        </p>
                    </button>

                    {/* Admin Role Button — only if user is admin */}
                    {isAdmin ? (
                        <button
                            onClick={() => onSelect('admin')}
                            className={`group relative flex flex-col items-center justify-center p-6 rounded-3xl border transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${
                                theme === 'light'
                                    ? 'bg-white/80 border-gray-200 shadow-xl shadow-gray-200/50 hover:bg-white'
                                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:shadow-[0_0_30px_rgba(59,130,246,0.2)]'
                            }`}
                        >
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors border ${
                                theme === 'light'
                                    ? 'bg-blue-500/10 border-blue-500/20'
                                    : 'bg-blue-500/20 border-blue-500/30 group-hover:bg-blue-500/30'
                            }`}>
                                <ShieldCheck className="w-8 h-8 text-blue-500" />
                            </div>
                            <h3 className={`text-lg font-bold mb-2 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>مشرف</h3>
                            <p className={`text-xs text-center leading-relaxed ${theme === 'light' ? 'text-slate-500' : 'text-white/60'}`}>
                                الدخول للوحة الإدارة والتحكم بالنظام
                            </p>
                        </button>
                    ) : null}

                    {/* Capacities Role Button — only for eligible employees */}
                    {hasCapacities ? (
                        <button
                            onClick={handleCapacitiesClick}
                            className={`group relative flex flex-col items-center justify-center p-6 rounded-3xl border transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${
                                theme === 'light'
                                    ? 'bg-white/80 border-gray-200 shadow-xl shadow-gray-200/50 hover:bg-white'
                                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:shadow-[0_0_30px_rgba(168,85,247,0.2)]'
                            }`}
                        >
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors border ${
                                theme === 'light'
                                    ? 'bg-purple-500/10 border-purple-500/20'
                                    : 'bg-purple-500/20 border-purple-500/30 group-hover:bg-purple-500/30'
                            }`}>
                                <BarChart3 className="w-8 h-8 text-purple-500" />
                            </div>
                            <h3 className={`text-lg font-bold mb-2 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>قسم السعات</h3>
                            <p className={`text-xs text-center leading-relaxed ${theme === 'light' ? 'text-slate-500' : 'text-white/60'}`}>
                                الدخول لنظام إدارة السعات والاشتراكات
                            </p>
                        </button>
                    ) : null}
                </div>
            </div>

            {/* Footer */}
            <div className="absolute bottom-0 left-0 right-0 z-20">
                <AppFooter />
            </div>
        </div>
    );
};
