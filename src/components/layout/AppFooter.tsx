import { Code2 } from "lucide-react";
import TipsMarquee from "../ui/TipsMarquee";

export const AppFooter = () => {
    return (
        <footer className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-xl shadow-[0_-4px_20px_rgba(0,0,0,0.4)] flex flex-col">

            {/* Line 1: News Ticker */}
            <TipsMarquee appName="InfTeleKarbala" />

            <div className="max-w-7xl mx-auto px-6 py-3 w-full border-t border-blue-500/20">
                <div className="flex flex-col gap-2">
                    {/* Line 2: System Title */}
                    <div className="text-center relative">
                        {/* Decorative lines */}
                        <div className="absolute top-1/2 left-0 w-1/4 h-px bg-gradient-to-r from-transparent to-blue-500/20"></div>
                        <div className="absolute top-1/2 right-0 w-1/4 h-px bg-gradient-to-l from-transparent to-blue-500/20"></div>

                        <span className="text-blue-400 font-bold text-sm md:text-base tracking-wide drop-shadow-[0_2px_10px_rgba(96,165,250,0.3)]">
                            نظام الادارة والمالية / اتصالات ومعلوماتية كربلاء
                        </span>
                    </div>

                    {/* Line 3: Credits & Version */}
                    <div className="flex items-center justify-between text-[10px] md:text-xs text-white/50 font-mono">
                        <div className="flex items-center gap-2 transition-colors hover:text-blue-300">
                            <Code2 className="w-3 h-3" />
                            <span>اعداد المهندس مسلم عقيل</span>
                        </div>

                        <div className="tracking-widest opacity-70">
                            نسخة v0.0.1
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Glow Line */}
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500/40 to-transparent"></div>
        </footer>
    );
};
