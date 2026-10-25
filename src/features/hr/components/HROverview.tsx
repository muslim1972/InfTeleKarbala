import { LayoutDashboard, Send, Inbox, FolderArchive, ScrollText, ClipboardList, Clock, ArrowRight } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { cn } from '../../../lib/utils';
import type { HRTabType } from '../types';

interface HROverviewProps {
    onNavigateTab: (tab: HRTabType) => void;
}

export const HROverview = ({ onNavigateTab }: HROverviewProps) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Hero / Intro Card */}
            <div className={cn(
                "p-6 rounded-3xl border relative overflow-hidden",
                isDark
                    ? "bg-gradient-to-br from-rose-950/40 via-slate-900/60 to-slate-950 border-rose-500/20"
                    : "bg-gradient-to-br from-rose-50 via-white to-slate-50 border-rose-200/80 shadow-md"
            )}>
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold border border-rose-500/20">
                            <LayoutDashboard className="w-3.5 h-3.5" />
                            <span>منظومة إدارة الموارد البشرية والذاتية</span>
                        </div>
                        <h2 className="text-xl md:text-2xl font-bold text-foreground">
                            مرحباً بك في شعبة الموارد البشرية (الذاتية)
                        </h2>
                        <p className="text-xs md:text-sm text-muted-foreground max-w-2xl leading-relaxed">
                            لوحة العمل الموحدة لإدارة طلبات الإجازات، وتوثيق سجلات الصادر والوارد الرسمية، والإضبارات الإلكترونية لمنتسبي مديرية اتصالات ومعلوماتية كربلاء.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => onNavigateTab('requests')}
                            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-rose-600/20 transition-all active:scale-95"
                        >
                            <ClipboardList className="w-4 h-4" />
                            <span>الطلبات والموافقات</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div
                    onClick={() => onNavigateTab('requests')}
                    className={cn(
                        "p-4 rounded-2xl border cursor-pointer transition-all hover:scale-[1.02] active:scale-98",
                        isDark ? "bg-slate-900/50 border-slate-800 hover:border-amber-500/40" : "bg-white border-slate-200 hover:border-amber-400 shadow-sm"
                    )}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground font-medium">طلبات بانتظار الاعتماد</span>
                        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                            <Clock className="w-4 h-4" />
                        </div>
                    </div>
                    <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">عاجل</span>
                    <p className="text-[11px] text-muted-foreground mt-1">طلبات قطع وإجازات واردة</p>
                </div>

                <div
                    onClick={() => onNavigateTab('outgoing')}
                    className={cn(
                        "p-4 rounded-2xl border cursor-pointer transition-all hover:scale-[1.02] active:scale-98",
                        isDark ? "bg-slate-900/50 border-slate-800 hover:border-rose-500/40" : "bg-white border-slate-200 hover:border-rose-400 shadow-sm"
                    )}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground font-medium">الكتب الصادرة</span>
                        <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600">
                            <Send className="w-4 h-4" />
                        </div>
                    </div>
                    <span className="text-2xl font-bold text-rose-600 dark:text-rose-400">142</span>
                    <p className="text-[11px] text-muted-foreground mt-1">كتاب رسمي صادر لعام 2026</p>
                </div>

                <div
                    onClick={() => onNavigateTab('incoming')}
                    className={cn(
                        "p-4 rounded-2xl border cursor-pointer transition-all hover:scale-[1.02] active:scale-98",
                        isDark ? "bg-slate-900/50 border-slate-800 hover:border-blue-500/40" : "bg-white border-slate-200 hover:border-blue-400 shadow-sm"
                    )}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground font-medium">الكتب الواردة</span>
                        <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                            <Inbox className="w-4 h-4" />
                        </div>
                    </div>
                    <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">89</span>
                    <p className="text-[11px] text-muted-foreground mt-1">بريد وارد ومحال للشعب</p>
                </div>

                <div
                    onClick={() => onNavigateTab('orders')}
                    className={cn(
                        "p-4 rounded-2xl border cursor-pointer transition-all hover:scale-[1.02] active:scale-98",
                        isDark ? "bg-slate-900/50 border-slate-800 hover:border-purple-500/40" : "bg-white border-slate-200 hover:border-purple-400 shadow-sm"
                    )}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground font-medium">الأوامر الإدارية</span>
                        <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600">
                            <ScrollText className="w-4 h-4" />
                        </div>
                    </div>
                    <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">54</span>
                    <p className="text-[11px] text-muted-foreground mt-1">أمر إداري وتكليف ولجان</p>
                </div>
            </div>

            {/* Quick Action Navigation Panels */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Panel 1: Outgoing & Incoming */}
                <div className={cn(
                    "p-5 rounded-2xl border space-y-3",
                    isDark ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200 shadow-sm"
                )}>
                    <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                        <Send className="w-4 h-4 text-rose-500" />
                        <span>منظومة الصادر والوارد والمراسلات</span>
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        توثيق المراسلات الرسمية بين المديرية والوزارة والدوائر الخارجية، وتوزيع البريد الوارد وإحالته، وإعطاء أرقام صادر ووارد فورية.
                    </p>
                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={() => onNavigateTab('outgoing')}
                            className="flex-1 py-2 px-3 rounded-xl border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                        >
                            <span>فتح سجل الصادر</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={() => onNavigateTab('incoming')}
                            className="flex-1 py-2 px-3 rounded-xl border border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                        >
                            <span>فتح سجل الوارد</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Panel 2: Dossiers & Orders */}
                <div className={cn(
                    "p-5 rounded-2xl border space-y-3",
                    isDark ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200 shadow-sm"
                )}>
                    <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                        <FolderArchive className="w-4 h-4 text-emerald-500" />
                        <span>الإضبارات الإلكترونية والأوامر</span>
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        أرشيف إلكتروني للملفات الوظيفية والمستمسكات الرسمية وأوامر التعيين والترفيعات، مع محرك صياغة الأوامر الإدارية وتشكيل اللجان.
                    </p>
                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={() => onNavigateTab('dossiers')}
                            className="flex-1 py-2 px-3 rounded-xl border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                        >
                            <span>فتح الإضبارات</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={() => onNavigateTab('orders')}
                            className="flex-1 py-2 px-3 rounded-xl border border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                        >
                            <span>الأوامر الإدارية</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
