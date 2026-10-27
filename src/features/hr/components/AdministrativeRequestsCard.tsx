import { Layers, ChevronDown, ChevronUp, Fuel, CreditCard, ArrowLeftRight, Clock } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { cn } from '../../../lib/utils';

interface AdministrativeRequestsCardProps {
    isExpanded: boolean;
    onToggle: () => void;
}

const ADMIN_REQUEST_SERVICES = [
    {
        id: 'fuel',
        title: 'طلبات حصص الوقود',
        icon: Fuel,
        color: 'text-amber-500',
        bgColor: 'bg-amber-500/10',
        status: 'قيد الربط والتطوير الميداني',
        description: 'طلبات تخصيص وتوزيع حصص الوقود لمركبات وآليات المديرية والمولدات'
    },
    {
        id: 'id_card',
        title: 'طلبات إصدار وتجديد الهويات',
        icon: CreditCard,
        color: 'text-sky-500',
        bgColor: 'bg-sky-500/10',
        status: 'قيد التدشين',
        description: 'إصدار الهوية التعريفية للموظفين الجدد وتجديد الهويات التالفة والنافذة'
    },
    {
        id: 'transfer',
        title: 'طلبات نقل الخدمات والتنسيب',
        icon: ArrowLeftRight,
        color: 'text-purple-500',
        bgColor: 'bg-purple-500/10',
        status: 'قيد الربط والتطوير الميداني',
        description: 'طلبات النقل بين الأقسام والشعب ومجمعات الاتصالات في المحافظة'
    }
];

export const AdministrativeRequestsCard = ({
    isExpanded,
    onToggle
}: AdministrativeRequestsCardProps) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    return (
        <div className={cn(
            "rounded-2xl border shadow-sm transition-all overflow-hidden",
            isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200"
        )}>
            {/* Header */}
            <div
                onClick={onToggle}
                className={cn(
                    "p-4 flex items-center justify-between cursor-pointer select-none transition-colors",
                    isDark ? "hover:bg-slate-800/40" : "hover:bg-slate-50"
                )}
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                        <Layers className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm text-foreground">
                                الخدمات والطلبات الإدارية العامة
                            </h3>
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 font-mono">
                                {ADMIN_REQUEST_SERVICES.length} خدمات
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            متابعة وإدارة طلبات الوقود، الهويات الوظيفية، ونقل الخدمات
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                </div>
            </div>

            {/* Body */}
            {isExpanded && (
                <div className="p-4 border-t border-border space-y-3 animate-in fade-in duration-200">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {ADMIN_REQUEST_SERVICES.map(srv => {
                            const IconComponent = srv.icon;
                            return (
                                <div
                                    key={srv.id}
                                    className={cn(
                                        "p-4 rounded-xl border flex flex-col justify-between gap-3",
                                        isDark ? "bg-slate-800/40 border-slate-700" : "bg-slate-50 border-slate-200"
                                    )}
                                >
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", srv.bgColor)}>
                                                <IconComponent className={cn("w-5 h-5", srv.color)} />
                                            </div>
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary text-muted-foreground">
                                                {srv.status}
                                            </span>
                                        </div>
                                        <h4 className="font-bold text-xs text-foreground">{srv.title}</h4>
                                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                                            {srv.description}
                                        </p>
                                    </div>

                                    <div className="pt-2 border-t border-border/50 text-[10px] text-muted-foreground flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        <span>التوجيه الآلي مفعّل لشعبة الموارد البشرية</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
