import { useState } from "react";
import { User, Power, Settings } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { useAuth } from "../../context/AuthContext";
import { SettingsModal } from "../features/SettingsModal";

interface AppHeaderProps {
    bottomContent?: React.ReactNode;
    title?: string;
    showUserName?: boolean; // Show user name next to avatar
}

export const AppHeader = ({ bottomContent, title, showUserName = false }: AppHeaderProps) => {
    const { user, logout } = useAuth();
    const [showSettings, setShowSettings] = useState(false);

    if (!user) return null;

    return (
        <>
            <header className="sticky top-0 z-[60] py-2 px-4 w-full">
                <GlassCard className="flex flex-col p-3 !bg-[#0f172a]/80 !border-white/10 !rounded-3xl backdrop-blur-xl transition-none !overflow-visible">
                    <div className="flex items-center justify-between w-full">
                        {/* Right: Avatar + User Name - Clickable for Settings */}
                        <button
                            onClick={() => setShowSettings(true)}
                            className="flex items-center gap-3 hover:bg-white/5 p-1 rounded-xl transition-colors group"
                        >
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-yellow-DEFAULT to-brand-green-DEFAULT flex items-center justify-center shadow-lg border-2 border-white/20 overflow-hidden relative">
                                {user.avatar_url ? (
                                    <img src={user.avatar_url} alt="User" className="w-full h-full object-cover" />
                                ) : (
                                    <User className="w-5 h-5 text-white" />
                                )}

                                {/* Hover overlay hint */}
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Settings className="w-4 h-4 text-white" />
                                </div>
                            </div>
                            {showUserName && (
                                <div className="text-right">
                                    <h2 className="text-white font-bold text-sm md:text-base font-tajawal group-hover:text-brand-yellow transition-colors">
                                        {user?.full_name ? user.full_name.split(' ').slice(0, 2).join(' ') : 'زائر'}
                                    </h2>
                                    <p className="text-xs text-white/50 font-cairo">
                                        {user?.role === 'admin' ? 'مدير النظام' : 'الحساب الشخصي'}
                                    </p>
                                </div>
                            )}
                        </button>

                        {/* Left: Title + Logout Button */}
                        <div className="flex items-center gap-4">
                            {title && (
                                <h1 className="text-white font-bold text-lg md:text-xl font-tajawal">{title}</h1>
                            )}

                            <button
                                onClick={logout}
                                className="p-2 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-red-400 transition-colors border border-red-500/20"
                                title="تسجيل الخروج"
                            >
                                <Power className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {bottomContent && (
                        <div className="mt-3 pt-3 border-t border-white/10 w-full animate-in fade-in slide-in-from-top-1 duration-200 overflow-visible relative">
                            {bottomContent}
                        </div>
                    )}
                </GlassCard>
            </header >

            <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
        </>
    );
};
