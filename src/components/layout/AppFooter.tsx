import { Code2 } from "lucide-react";
import TipsMarquee from "../ui/TipsMarquee";

export const AppFooter = () => {
    return (
        <footer className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-xl shadow-[0_-4px_20px_rgba(0,0,0,0.4)] flex flex-col">

            {/* Line 1: News Ticker */}
            <TipsMarquee appName="InfTeleKarbala" />

            <div className="max-w-7xl mx-auto px-6 pt-[2px] pb-4 w-full border-t border-blue-500/20">
                <div className="flex flex-col gap-1">
                    {/* Line 2: System Title */}
                    <div className="text-center relative max-w-full overflow-hidden">
                        {/* Decorative lines */}
                        <div className="absolute top-1/2 left-0 w-1/4 h-px bg-gradient-to-r from-transparent to-blue-500/20"></div>
                        <div className="absolute top-1/2 right-0 w-1/4 h-px bg-gradient-to-l from-transparent to-blue-500/20"></div>

                        <span className="text-blue-400 font-bold text-[clamp(9px,3vw,16px)] tracking-wide drop-shadow-[0_2px_10px_rgba(96,165,250,0.3)] whitespace-nowrap block truncate sm:text-sm md:text-base px-4">
                            نظام الادارة الموحد / اتصالات ومعلوماتية كربلاء المقدسة
                        </span>
                    </div>

                    {/* Line 3: Credits & Version */}
                    <div className="flex items-center justify-between text-[10px] md:text-xs text-white/50 font-mono relative pt-1">
                        <div className="flex items-center gap-2 transition-colors hover:text-blue-300">
                            <Code2 className="w-3 h-3" />
                            <span>اعداد المهندس مسلم عقيل</span>
                        </div>

                        {/* Signature Image - Centered with Solar Halo */}
                        <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center w-12 h-12">
                            {/* Halo Effect - Sun Rays */}
                            <div className="absolute w-full h-full bg-yellow-500/40 rounded-full blur-sm animate-ripple" style={{ animationDelay: '0s' }} />
                            <div className="absolute w-full h-full bg-yellow-400/30 rounded-full blur-md animate-ripple" style={{ animationDelay: '0.6s' }} />
                            <div className="absolute w-full h-full bg-orange-400/20 rounded-full blur-lg animate-ripple" style={{ animationDelay: '1.2s' }} />

                            {/* The Image */}
                            <img
                                src="/MyName.png"
                                alt="Signature"
                                className="h-10 md:h-12 w-auto opacity-100 relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]"
                            />
                        </div>

                        <div className="tracking-widest opacity-70 mr-6">
                            النسخة التجريبية v{__APP_VERSION__}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Glow Line */}
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500/40 to-transparent"></div>
        </footer>
    );
};
