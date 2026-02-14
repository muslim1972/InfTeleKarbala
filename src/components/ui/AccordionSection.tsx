import { ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import type { ReactNode } from "react";

interface AccordionSectionProps {
    title: string;
    icon: LucideIcon;
    isOpen: boolean;
    onToggle: () => void;
    children: ReactNode;
    color?: string;
    className?: string; // Added for extra flexibility
    id?: string;
}

export function AccordionSection({ title, icon: Icon, isOpen, onToggle, children, color, className, id }: AccordionSectionProps) {
    // Determine background style based on color prop
    // Styles are APPLIED BY DEFAULT (not just on hover) to ensure mobile visibility as requested.

    const getColorClasses = () => {
        if (color?.includes('cyan')) return {
            bg: "bg-cyan-500/10 dark:bg-cyan-500/10",
            border: "border-cyan-500/30 dark:border-cyan-500/30 ring-cyan-500/20",
            iconBg: "bg-cyan-500 text-white shadow-lg shadow-cyan-500/30",
            text: "text-cyan-900 dark:text-cyan-100",
            indicator: "bg-cyan-500",
            wrapperBorder: "border-cyan-500/30 dark:border-cyan-500/30"
        };
        if (color?.includes('blue')) return {
            bg: "bg-blue-500/10 dark:bg-blue-500/10",
            border: "border-blue-500/30 dark:border-blue-500/30 ring-blue-500/20",
            iconBg: "bg-blue-500 text-white shadow-lg shadow-blue-500/30",
            text: "text-blue-900 dark:text-blue-100",
            indicator: "bg-blue-500",
            wrapperBorder: "border-blue-500/30 dark:border-blue-500/30"
        };
        if (color?.includes('green')) return {
            bg: "bg-emerald-500/10 dark:bg-emerald-500/10",
            border: "border-emerald-500/30 dark:border-emerald-500/30 ring-emerald-500/20",
            iconBg: "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30",
            text: "text-emerald-900 dark:text-emerald-100",
            indicator: "bg-emerald-500",
            wrapperBorder: "border-emerald-500/30 dark:border-emerald-500/30"
        };
        if (color?.includes('red')) return {
            bg: "bg-rose-500/10 dark:bg-rose-500/10",
            border: "border-rose-500/30 dark:border-rose-500/30 ring-rose-500/20",
            iconBg: "bg-rose-500 text-white shadow-lg shadow-rose-500/30",
            text: "text-rose-900 dark:text-rose-100",
            indicator: "bg-rose-500",
            wrapperBorder: "border-rose-500/30 dark:border-rose-500/30"
        };
        if (color?.includes('slate')) return {
            bg: "bg-slate-500/10 dark:bg-slate-500/10",
            border: "border-slate-500/30 dark:border-slate-500/30 ring-slate-500/20",
            iconBg: "bg-slate-500 text-white shadow-lg shadow-slate-500/30",
            text: "text-slate-900 dark:text-slate-100",
            indicator: "bg-slate-500",
            wrapperBorder: "border-slate-500/30 dark:border-slate-500/30"
        };
        if (color?.includes('teal')) return {
            bg: "bg-teal-500/10 dark:bg-teal-500/10",
            border: "border-teal-500/30 dark:border-teal-500/30 ring-teal-500/20",
            iconBg: "bg-teal-500 text-white shadow-lg shadow-teal-500/30",
            text: "text-teal-900 dark:text-teal-100",
            indicator: "bg-teal-500",
            wrapperBorder: "border-teal-500/30 dark:border-teal-500/30"
        };
        if (color?.includes('purple')) return {
            bg: "bg-purple-500/10 dark:bg-purple-500/10",
            border: "border-purple-500/30 dark:border-purple-500/30 ring-purple-500/20",
            iconBg: "bg-purple-500 text-white shadow-lg shadow-purple-500/30",
            text: "text-purple-900 dark:text-purple-100",
            indicator: "bg-purple-500",
            wrapperBorder: "border-purple-500/30 dark:border-purple-500/30"
        };
        if (color?.includes('yellow') || color?.includes('amber')) return {
            bg: "bg-amber-500/10 dark:bg-amber-500/10",
            border: "border-amber-500/30 dark:border-amber-500/30 ring-amber-500/20",
            iconBg: "bg-amber-500 text-white shadow-lg shadow-amber-500/30",
            text: "text-amber-900 dark:text-amber-100",
            indicator: "bg-amber-500",
            wrapperBorder: "border-amber-500/30 dark:border-amber-500/30"
        };

        // Default (Gray/Glass) - maintained for non-colored sections
        return {
            bg: isOpen ? "bg-gray-100 dark:bg-white/5" : "hover:bg-gray-50 dark:hover:bg-white/5",
            border: isOpen ? "border-gray-200 dark:border-white/10 ring-gray-200 dark:ring-white/10" : "hover:border-gray-300 dark:hover:border-white/20",
            iconBg: isOpen ? "bg-gray-900 dark:bg-white text-white dark:text-black" : "bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white",
            text: isOpen ? "text-gray-900 dark:text-gray-100" : "text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white",
            indicator: "bg-gray-900 dark:bg-white",
            wrapperBorder: "border-gray-200 dark:border-white/5"
        };
    };

    const styles = getColorClasses();

    return (
        <div id={id} className={cn("group rounded-xl overflow-hidden border mx-auto w-full transition-all duration-300",
            isOpen ? "ring-1" : (color ? "border-transparent" : "border-transparent bg-transparent"),
            // If color is present, we apply the colored border ALWAYS
            color ? styles.wrapperBorder : styles.border,
            className
        )}>
            <button
                onClick={onToggle}
                className={cn(
                    "w-full p-4 flex items-center justify-between transition-all duration-300 relative overflow-hidden backdrop-blur-md",
                    // Apply background style: always visible if color is present
                    styles.bg,
                    // Active State
                    isOpen ? "shadow-sm" : ""
                )}
            >
                {/* Accent Line */}
                <div className={cn("absolute inset-y-0 right-0 w-1 transition-all duration-300",
                    isOpen ? styles.indicator : (color ? styles.indicator : "bg-transparent group-hover:opacity-50"),
                    !isOpen && color && "opacity-60" // Dim indicator slightly when closed but keep it visible
                )} />

                <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg transition-all duration-300", styles.iconBg)}>
                        <Icon className="w-5 h-5" />
                    </div>
                    <span className={cn("font-bold text-sm transition-colors duration-300", styles.text)}>
                        {title}
                    </span>
                </div>

                <ChevronDown className={cn("w-5 h-5 transition-transform duration-300", isOpen ? "rotate-180 opacity-100" : "opacity-50", styles.text)} />
            </button>

            <div className={cn("grid transition-all duration-300 ease-in-out bg-white/50 dark:bg-black/10", isOpen ? "grid-rows-[1fr] opacity-100 py-4" : "grid-rows-[0fr] opacity-0 py-0")}>
                <div className="overflow-hidden px-4">
                    <div className="space-y-4">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
