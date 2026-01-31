import { LogOut, User } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { useAuth } from "../../context/AuthContext";

export const AppHeader = () => {
    const { user, logout } = useAuth();

    if (!user) return null;

    return (
        <header className="p-4 z-50 relative">
            <GlassCard className="flex items-center justify-between p-4 !bg-black/30 !border-white/10 !rounded-full">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-yellow-DEFAULT to-brand-green-DEFAULT flex items-center justify-center shadow-lg border-2 border-white/20">
                        <User className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-white font-bold text-sm md:text-base font-tajawal">{user?.full_name || 'زائر'}</h1>
                        <p className="text-white/60 text-xs font-tajawal">الرقم الوظيفي: {user?.job_number || 'غير متوفر'}</p>
                    </div>
                </div>

                <button
                    onClick={logout}
                    className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-red-400 transition-colors"
                    title="تسجيل الخروج"
                >
                    <LogOut className="w-5 h-5" />
                </button>
            </GlassCard>
        </header>
    );
};
