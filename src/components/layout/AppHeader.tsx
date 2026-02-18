import { useState } from "react";
import { User, Power, Settings, Sun, Moon } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { useAuth } from "../../context/AuthContext";
import { SettingsModal } from "../features/SettingsModal";
import { useTheme } from "../../context/ThemeContext";

interface AppHeaderProps {
    bottomContent?: React.ReactNode;
    title?: string;
    showUserName?: boolean; // Show user name next to avatar
}

export const AppHeader = ({ bottomContent, title, showUserName = false }: AppHeaderProps) => {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [showSettings, setShowSettings] = useState(false);

    if (!user) return null;

    return (
        <>
            <header className="sticky top-0 z-[60] py-1 px-2 w-full">
                <GlassCard className={`flex flex-col p-2 !rounded-2xl backdrop-blur-xl transition-colors duration-300 !overflow-visible ${theme === 'light'
                    ? '!bg-white/95 !border-gray-200'
                    : '!bg-[#0f172a]/80 !border-white/10'
                    }`}>
                    <div className="flex items-center justify-between w-full">
                        {/* Right: Avatar + User Name - Clickable for Settings */}
                        <button
                            onClick={() => setShowSettings(true)}
                            className="flex items-center gap-2 hover:bg-white/5 p-1 rounded-lg transition-colors group"
                        >
                            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-brand-yellow-DEFAULT to-brand-green-DEFAULT flex items-center justify-center shadow-lg border-2 border-white/20 overflow-hidden relative">
                                {user.avatar_url ? (
                                    <img src={user.avatar_url} alt="User" className="w-full h-full object-cover" />
                                ) : (
                                    <User className="w-4 h-4 text-white dark:text-white" />
                                )}

                                {/* Hover overlay hint */}
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Settings className="w-3 h-3 text-white" />
                                </div>
                            </div>
                            {showUserName && (
                                <div className="text-right">
                                    <h2 className={`font-bold text-sm font-tajawal group-hover:text-brand-yellow transition-colors ${theme === 'light' ? 'text-gray-900' : 'text-white'
                                        }`}>
                                        {user?.full_name ? user.full_name.split(' ').slice(0, 2).join(' ') : 'زائر'}
                                    </h2>
                                    <p className={`text-[10px] font-cairo ${theme === 'light' ? 'text-gray-600' : 'text-white/50'
                                        }`}>
                                        {user?.role === 'admin' ? 'مدير النظام' : 'الحساب الشخصي'}
                                    </p>
                                </div>
                            )}
                        </button>

                        {/* Center: Theme Toggle */}
                        <button
                            onClick={toggleTheme}
                            className={`flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300 group border relative overflow-hidden ${theme === 'light'
                                ? 'bg-black border-black/10' // Light Mode -> Show Moon in Black Circle
                                : 'bg-white border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.3)]' // Dark Mode -> Show Sun in White Circle
                                }`}
                            title={theme === 'dark' ? 'التبديل للوضع النهاري' : 'التبديل للوضع الليلي'}
                        >
                            {/* Icon Rotation & Scale Transition */}
                            <div className="relative flex items-center justify-center">
                                {theme === 'dark' ? (
                                    // Sun Icon (Glowing Yellow)
                                    <Sun className="w-5 h-5 text-yellow-500 fill-yellow-500 animate-in fade-in zoom-in duration-300 drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]" />
                                ) : (
                                    // Moon Icon (White)
                                    <Moon className="w-4 h-4 text-white fill-white animate-in fade-in zoom-in duration-300" />
                                )}
                            </div>
                        </button>
                        {/* Left: Title + Logout Button */}
                        <div className="flex items-center gap-2">
                            {title && (
                                <h1 className={`font-bold text-base md:text-lg font-tajawal ${theme === 'light' ? 'text-gray-900' : 'text-white'
                                    }`}>{title}</h1>
                            )}


                            <button
                                onClick={logout}
                                className="p-1.5 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-red-400 transition-colors border border-red-500/20"
                                title="تسجيل الخروج"
                            >
                                <Power className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {bottomContent && (
                        <div className="mt-1 pt-1 border-t border-white/10 w-full animate-in fade-in slide-in-from-top-1 duration-200 overflow-visible relative">
                            {bottomContent}
                        </div>
                    )}
                </GlassCard>
            </header >

            <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
        </>
    );
};
