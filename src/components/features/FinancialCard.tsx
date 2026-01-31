import { GlassCard } from "../ui/GlassCard";
import { cn } from "../../lib/utils";
import { Copy } from "lucide-react";

interface FinancialCardProps {
    label: string;
    value: string | number;
    highlight?: boolean;
    isIban?: boolean;
    copyable?: boolean;
    className?: string;
}

export const FinancialCard = ({
    label,
    value,
    highlight = false,
    isIban = false,
    copyable = false,
    className
}: FinancialCardProps) => {

    const handleCopy = () => {
        if (copyable && value) {
            navigator.clipboard.writeText(value.toString());
            // Could add toast here
        }
    };

    return (
        <GlassCard
            className={cn(
                "flex flex-col p-4 relative group",
                highlight ? "bg-gradient-to-br from-brand-green/20 to-brand-green/5 border-brand-green/30" : "",
                className
            )}
            hoverEffect
            onClick={copyable ? handleCopy : undefined}
        >
            <span className="text-white/60 text-xs mb-1 font-medium">{label}</span>

            <div className="flex items-center justify-between gap-2">
                <span className={cn(
                    "font-bold text-lg md:text-xl",
                    isIban ? "font-mono tracking-wider text-brand-yellow-DEFAULT" : "text-white"
                )}>
                    {value}
                </span>

                {copyable && (
                    <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full hover:bg-white/10 active:scale-95 text-white/70">
                        <Copy className="w-4 h-4" />
                    </button>
                )}
            </div>
        </GlassCard>
    );
};
