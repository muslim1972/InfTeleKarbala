
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";
import { Wallet, FileText } from "lucide-react";

interface TabSystemProps {
    activeTab: 'financial' | 'administrative';
    onTabChange: (tab: 'financial' | 'administrative') => void;
}

export const TabSystem = ({ activeTab, onTabChange }: TabSystemProps) => {
    const tabs = [
        { id: 'financial', label: 'المالية', icon: Wallet },
        { id: 'administrative', label: 'الذاتية', icon: FileText },
    ] as const;

    return (
        <div className="relative flex p-1 bg-black/80 backdrop-blur-md rounded-2xl border border-white/5 mb-6 shadow-xl">
            {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;

                return (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={cn(
                            "relative flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-bold rounded-xl transition-colors z-0",
                            isActive ? "text-white" : "text-white/60 hover:text-white/80"
                        )}
                    >
                        {isActive && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute inset-0 bg-white/10 border border-white/10 shadow-lg rounded-xl -z-10"
                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                        )}
                        <Icon className="w-4 h-4" />
                        <span>{tab.label}</span>
                    </button>
                );
            })}
        </div>
    );
};
