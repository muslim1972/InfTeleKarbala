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
    return (
        <div id={id} className={cn("rounded-2xl overflow-hidden shadow-lg border border-white/5 mx-auto w-full", className)}>
            <button
                onClick={onToggle}
                className={cn(
                    "w-full p-3 flex items-center justify-between text-white transition-all bg-gradient-to-r hover:brightness-110",
                    color ? color : "from-emerald-600 to-emerald-500"
                )}
            >
                <div className="flex items-center gap-2">
                    <div className="bg-white/20 p-1.5 rounded-lg">
                        <Icon className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-sm">{title}</span>
                </div>
                <ChevronDown className={cn("w-5 h-5 transition-transform duration-300", isOpen ? "rotate-180" : "")} />
            </button>
            {isOpen && (
                <div className="p-4 bg-black/20 border-t border-white/5 space-y-4 animate-in slide-in-from-top-2 duration-300">
                    {children}
                </div>
            )}
        </div>
    );
}
