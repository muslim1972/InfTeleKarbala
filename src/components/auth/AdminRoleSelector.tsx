import { User, ShieldCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { AppFooter } from "../layout/AppFooter";

interface AdminRoleSelectorProps {
    onSelect: (role: 'admin' | 'user') => void;
}

export const AdminRoleSelector = ({ onSelect }: AdminRoleSelectorProps) => {
    const { user } = useAuth();

    return (
        <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-gray-900 font-tao">
            {/* Smart Background Layer */}
            <div
                className="absolute inset-0 z-0 bg-cover bg-center scale-105"
                style={{ backgroundImage: `url('/sign-in.jpg')` }}
            >
                {/* Overlay */}
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
            </div>

            {/* Main Content */}
            <div className="relative z-10 w-full max-w-lg p-6 flex flex-col items-center">

                <div className="text-center mb-10 space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <h1 className="text-3xl md:text-4xl font-bold text-white font-tajawal drop-shadow-lg">
                        مرحباً بك، {user?.full_name}
                    </h1>
                    <p className="text-white/80 text-lg">
                        يرجى اختيار طريقة الدخول
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-100">
                    {/* User Role Button */}
                    <button
                        onClick={() => onSelect('user')}
                        className="group relative flex flex-col items-center justify-center p-8 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(34,197,94,0.2)]"
                    >
                        <div className="w-20 h-20 rounded-full bg-brand-green/20 flex items-center justify-center mb-6 group-hover:bg-brand-green/30 transition-colors border border-brand-green/30">
                            <User className="w-10 h-10 text-brand-green" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">مستخدم</h3>
                        <p className="text-sm text-white/60 text-center">
                            الدخول للصلاحيات الشخصية ومتابعة السجلات
                        </p>
                    </button>

                    {/* Admin Role Button */}
                    <button
                        onClick={() => onSelect('admin')}
                        className="group relative flex flex-col items-center justify-center p-8 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(59,130,246,0.2)]"
                    >
                        <div className="w-20 h-20 rounded-full bg-blue-500/20 flex items-center justify-center mb-6 group-hover:bg-blue-500/30 transition-colors border border-blue-500/30">
                            <ShieldCheck className="w-10 h-10 text-blue-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">مشرف</h3>
                        <p className="text-sm text-white/60 text-center">
                            الدخول للوحة الإدارة والتحكم بالنظام
                        </p>
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
