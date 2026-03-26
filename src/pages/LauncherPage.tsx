import { useState } from "react";
import { Login } from "./Login";

export const LauncherPage = () => {
    const [showLogin, setShowLogin] = useState(false);

    // If user chose InfTeleKarbala, show the existing Login page
    if (showLogin) {
        return <Login onBack={() => setShowLogin(false)} />;
    }

    return (
        <div className="min-h-screen w-full flex flex-col relative overflow-hidden bg-gray-900 font-tao">
            {/* Background */}
            <div
                className="absolute inset-0 z-0 bg-cover bg-center scale-105"
                style={{ backgroundImage: `url('/sign-in.jpg')` }}
            >
                <div className="absolute inset-0 bg-black/50 backdrop-blur-[3px]"></div>
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/40"></div>
            </div>

            {/* Title */}
            <div className="relative z-10 text-center pt-8 pb-4 animate-in fade-in slide-in-from-top-4 duration-700">
                <h1 className="text-2xl md:text-3xl font-bold text-white/90 font-tajawal drop-shadow-lg">
                    مديرية الاتصالات ومعلوماتية كربلاء المقدسة
                </h1>
                <div className="h-1 w-20 bg-emerald-500 mx-auto rounded-full mt-3 shadow-[0_0_15px_rgba(34,197,94,0.6)]" />
            </div>

            {/* Two Logo Cards */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-6 px-6 pb-8">

                {/* Top Card: InfTeleKarbala */}
                <button
                    onClick={() => setShowLogin(true)}
                    className="group w-full max-w-xs flex flex-col items-center gap-4 p-6 rounded-3xl bg-white/[0.07] border border-white/10 backdrop-blur-md shadow-2xl transition-all duration-300 hover:bg-white/[0.12] hover:border-emerald-500/30 hover:shadow-[0_0_40px_rgba(34,197,94,0.15)] active:scale-[0.97] cursor-pointer"
                >
                    <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-white/20 shadow-2xl group-hover:border-emerald-400/50 transition-all duration-300 group-hover:shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                        <img
                            src="/icon-512.png"
                            alt="نظام الإدارة الموحد"
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                    </div>
                    <div className="text-center">
                        <h2 className="text-xl font-bold text-white font-tajawal group-hover:text-emerald-300 transition-colors duration-300">
                            نظام الإدارة الموحد
                        </h2>
                        <p className="text-white/50 text-sm mt-1 group-hover:text-white/70 transition-colors">
                            إدارة الموظفين والطلبات والدردشة
                        </p>
                    </div>
                    <div className="px-6 py-2 rounded-full bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-sm font-bold group-hover:bg-emerald-600/40 transition-all">
                        الدخول ←
                    </div>
                </button>

                {/* Bottom Card: Int-Karbala */}
                <a
                    href="https://itpc-management-system.onrender.com/"
                    className="group w-full max-w-xs flex flex-col items-center gap-4 p-6 rounded-3xl bg-white/[0.07] border border-white/10 backdrop-blur-md shadow-2xl transition-all duration-300 hover:bg-white/[0.12] hover:border-blue-500/30 hover:shadow-[0_0_40px_rgba(59,130,246,0.15)] active:scale-[0.97] cursor-pointer"
                >
                    <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-white/20 shadow-2xl group-hover:border-blue-400/50 transition-all duration-300 group-hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] bg-white">
                        <img
                            src="/Logo-Int-Karbala.jpeg"
                            alt="نظام إدارة الإنترنت"
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                    </div>
                    <div className="text-center">
                        <h2 className="text-xl font-bold text-white font-tajawal group-hover:text-blue-300 transition-colors duration-300">
                            نظام إدارة الإنترنت
                        </h2>
                        <p className="text-white/50 text-sm mt-1 group-hover:text-white/70 transition-colors">
                            قسم تجهيز خدمات المعلوماتية
                        </p>
                    </div>
                    <div className="px-6 py-2 rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-300 text-sm font-bold group-hover:bg-blue-600/40 transition-all">
                        الدخول ←
                    </div>
                </a>
            </div>
        </div>
    );
};
