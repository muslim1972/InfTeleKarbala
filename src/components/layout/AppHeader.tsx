import { LogOut, User } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { useAuth } from "../../context/AuthContext";

interface AppHeaderProps {
    bottomContent?: React.ReactNode;
    title?: string;
}

export const AppHeader = ({ bottomContent, title }: AppHeaderProps) => {
    const { user, logout } = useAuth();

    if (!user) return null;

    return (
        <header className="sticky top-0 z-[60] py-2 px-4 w-full">
            <GlassCard className="flex flex-col p-3 !bg-[#0f172a]/80 !border-white/10 !rounded-3xl backdrop-blur-xl transition-none">
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-yellow-DEFAULT to-brand-green-DEFAULT flex items-center justify-center shadow-lg border-2 border-white/20">
                            <User className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            {title ? (
                                <h1 className="text-white font-bold text-base md:text-lg font-tajawal">{title}</h1>
                            ) : (
                                <h1 className="text-white font-bold text-sm md:text-base font-tajawal">
                                    {user?.full_name ? user.full_name.split(' ').slice(0, 2).join(' ') : 'زائر'}
                                </h1>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={logout}
                        className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-red-400 transition-colors"
                        title="تسجيل الخروج"
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>

                {bottomContent && (
                    <div className="mt-3 pt-3 border-t border-white/10 w-full animate-in fade-in slide-in-from-top-1 duration-200">
                        {bottomContent}
                    </div>
                )}
            </GlassCard>
        </header>
    );
};
