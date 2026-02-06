
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";
import { Wallet, FileText, PieChart } from "lucide-react";

interface TabSystemProps {
    activeTab: 'financial' | 'administrative' | 'polls';
    onTabChange: (tab: 'financial' | 'administrative' | 'polls') => void;
}

export const TabSystem = ({ activeTab, onTabChange }: TabSystemProps) => {
    const tabs = [
        { id: 'financial', label: 'المالية', icon: Wallet },
        { id: 'administrative', label: 'الذاتية', icon: FileText },
        { id: 'polls', label: 'الاعلام', icon: PieChart },
    ] as const;

    return (
        <div className="relative flex gap-1 p-1 bg-muted/80 backdrop-blur-xl rounded-xl border border-white/10 dark:border-white/5 shadow-lg w-full ring-1 ring-black/5 dark:ring-white/5">
            {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;

                return (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={cn(
                            "relative flex-1 flex items-center justify-center gap-2 py-3 px-3 text-sm font-bold rounded-lg transition-all duration-300 z-0 overflow-hidden",
                            isActive
                                ? "text-white shadow-md animate-in zoom-in-95 duration-200"
                                : "text-muted-foreground hover:text-foreground hover:bg-white/10 dark:hover:bg-white/5"
                        )}
                    >
                        {isActive && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute inset-0 bg-gradient-to-r from-brand-green to-brand-green-dark shadow-[0_0_20px_rgba(34,197,94,0.4)] rounded-lg -z-10"
                                transition={{ type: "spring", bounce: 0.25, duration: 0.6 }}
                            >
                                {/* Shiny Overlay Effect */}
                                <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-50" />
                            </motion.div>
                        )}
                        <Icon className={cn("w-4 h-4 transition-transform", isActive && "scale-110")} />
                        <span className="relative z-10">{tab.label}</span>
                    </button>
                );
            })}
        </div>
    );
};
