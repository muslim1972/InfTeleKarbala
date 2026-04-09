import { Code2 } from "lucide-react";
import TipsMarquee from "../ui/TipsMarquee";

interface AppFooterProps {
    onDeveloperClick?: () => void;
}

export const AppFooter = ({ onDeveloperClick }: AppFooterProps) => {
    return (
        <footer className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-xl shadow-[0_-4px_20px_rgba(0,0,0,0.4)] flex flex-col">

            {/* Line 1: News Ticker */}
            <TipsMarquee appName="InfTeleKarbala" />

            <div className="max-w-7xl mx-auto px-4 pt-1 pb-[calc(0.4rem+env(safe-area-inset-bottom))] w-full border-t border-blue-500/10">
                <div className="flex flex-col gap-0.5 relative">
                    {/* Line 2: System Title - Smart Scaling using SVG to force single line without cutoff */}
                    <div className="relative w-full h-5 flex items-center justify-center overflow-hidden px-12">
                        <svg className="w-full h-full" viewBox="0 0 450 20" preserveAspectRatio="xMidYMid meet">
                            <text 
                                x="50%" y="50%" 
                                textAnchor="middle" 
                                dominantBaseline="middle" 
                                className="fill-blue-400 font-bold font-tajawal"
                                style={{ fontSize: '15px', filter: 'drop-shadow(0 2px 4px rgba(96, 165, 250, 0.3))' }}
                            >
                                نظام الادارة الموحد / اتصالات ومعلوماتية كربلاء المقدسة
                            </text>
                        </svg>
                        
                        {/* Decorative lines - Shortened to give more space for SVG and moved slightly */}
                        <div className="absolute top-1/2 left-0 w-[12%] h-px bg-gradient-to-r from-transparent to-blue-500/20"></div>
                        <div className="absolute top-1/2 right-0 w-[12%] h-px bg-gradient-to-l from-transparent to-blue-500/20"></div>
                    </div>

                    {/* Line 3: Credits & Version - Grid layout for better responsiveness */}
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center text-[clamp(9px,2.2vw,11px)] md:text-xs text-white/50 font-mono relative pt-0.5 gap-1">
                        {/* Left: Credits */}
                        <div className="flex items-center gap-1">
                            <Code2 className="w-3 h-3 shrink-0" />
                            <span className="whitespace-nowrap">اعداد م. مسلم عقيل</span>
                        </div>

                        {/* Center: Signature Image - Solar Halo */}
                        <div
                            onClick={onDeveloperClick}
                            className="flex items-center justify-center w-14 h-14 md:w-20 md:h-20 cursor-pointer group active:scale-95 transition-all z-[60] -my-4"
                        >
                            {/* Halo Effect - Sun Rays */}
                            <div className="absolute w-12 h-12 md:w-16 md:h-16 bg-yellow-500/30 rounded-full blur-[4px] animate-ripple group-hover:bg-blue-500/50" style={{ animationDelay: '0s' }} />
                            <div className="absolute w-12 h-12 md:w-16 md:h-16 bg-yellow-400/20 rounded-full blur-md animate-ripple group-hover:bg-blue-400/40" style={{ animationDelay: '0.6s' }} />
                            
                            {/* The Image */}
                            <img
                                src="/MyName.png"
                                alt="Signature"
                                className="h-12 md:h-16 w-auto opacity-100 relative z-10 drop-shadow-[0_2px_15px_rgba(255,255,255,0.4)] group-hover:brightness-125 group-hover:scale-110 transition-all duration-500"
                            />
                        </div>

                        {/* Right: Version */}
                        <div className="tracking-widest opacity-70 text-left flex justify-end overflow-hidden">
                            <span className="truncate">V-v{__APP_VERSION__}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Glow Line */}
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500/40 to-transparent"></div>
        </footer>
    );
};
