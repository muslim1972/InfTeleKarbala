import { Sun, Moon } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { cn } from "../../lib/utils";

export const ThemeToggleFloating = () => {
    const { theme, toggleTheme } = useTheme();

    return (
        <div className="fixed top-[calc(1rem+env(safe-area-inset-top))] left-6 z-[100] animate-in fade-in slide-in-from-left-8 duration-700">
            <button
                onClick={toggleTheme}
                className={cn(
                    "flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-500 group shadow-2xl backdrop-blur-xl border active:scale-90",
                    theme === 'light'
                        ? 'bg-white/80 border-gray-200 text-gray-900 shadow-gray-200/50'
                        : 'bg-black/40 border-white/10 text-white shadow-black/50'
                )}
                title={theme === 'dark' ? 'التبديل للوضع النهاري' : 'التبديل للوضع الليلي'}
            >
                <div className="relative flex items-center justify-center transition-transform duration-500 group-hover:rotate-12">
                    {theme === 'dark' ? (
                        <Sun className="w-6 h-6 text-yellow-400 fill-yellow-400 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
                    ) : (
                        <Moon className="w-6 h-6 text-indigo-600 fill-indigo-600" />
                    )}
                </div>
                
                {/* Status Indicator Dot */}
                <div className={cn(
                    "absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2",
                    theme === 'light' ? "bg-amber-400 border-white" : "bg-indigo-500 border-slate-900"
                )} />
            </button>
        </div>
    );
};
