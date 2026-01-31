import type { LucideIcon } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { cn } from "../../lib/utils";

interface StatCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    colorClass?: string;
    trend?: string;
}

export const StatCard = ({ title, value, icon: Icon, colorClass = "bg-brand-green", trend }: StatCardProps) => {
    return (
        <GlassCard className="p-5 flex items-center justify-between hover:bg-white/5 transition-colors">
            <div>
                <h3 className="text-white/60 text-sm mb-1">{title}</h3>
                <p className="text-2xl font-bold text-white font-tajawal">{value}</p>
                {trend && <span className="text-xs text-brand-green/80 flex items-center gap-1 mt-1">{trend}</span>}
            </div>

            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg", colorClass)}>
                <Icon className="w-6 h-6" />
            </div>
        </GlassCard>
    );
};
