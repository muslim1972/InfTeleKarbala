import { useState } from 'react';
import { FileCheck, ChevronDown, ChevronUp, Search, Printer, Building, Calendar, Loader2 } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { cn } from '../../../lib/utils';
import type { ContinuityRequestItem } from './ServiceContinuityProcessModal';

interface IssuedContinuityCardProps {
    records: ContinuityRequestItem[];
    isLoading: boolean;
    onRefresh: () => void;
    onSelect: (req: ContinuityRequestItem) => void;
    isExpanded: boolean;
    onToggle: () => void;
}

export const IssuedContinuityCard = ({
    records,
    isLoading,
    onRefresh: _onRefresh,
    onSelect,
    isExpanded,
    onToggle
}: IssuedContinuityCardProps) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [searchTerm, setSearchTerm] = useState('');

    const filtered = records.filter(item => {
        const name = item.employee?.full_name || '';
        const jobNo = item.employee?.job_number || '';
        const dest = item.destination_entity || '';
        const letNo = item.official_letter_number || '';
        const term = searchTerm.toLowerCase();

        return (
            name.toLowerCase().includes(term) ||
            jobNo.includes(term) ||
            dest.toLowerCase().includes(term) ||
            letNo.includes(term)
        );
    });

    return (
        <div className={cn(
            "rounded-2xl border shadow-sm transition-all overflow-hidden",
            isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200"
        )}>
            {/* Header / Click to expand */}
            <div
                onClick={onToggle}
                className={cn(
                    "p-4 flex items-center justify-between cursor-pointer select-none transition-colors",
                    isDark ? "hover:bg-slate-800/40" : "hover:bg-slate-50"
                )}
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                        <FileCheck className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm text-foreground">
                                كتب تأييد الاستمرارية المنجزة والصادرة
                            </h3>
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono">
                                {records.length}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            أرشيف الكتب الرسمية المعتمدة الصادرة للجهات المصرفية والحكومية
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

            {/* Expanded Body */}
            {isExpanded && (
                <div className="p-4 border-t border-border space-y-3 animate-in fade-in duration-200">
                    {/* Search & Counter */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
                        <div className="relative w-full sm:w-80">
                            <Search className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="ابحث برقم الصادر، اسم الموظف، أو الجهة..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className={cn(
                                    "w-full pr-9 pl-3 py-1.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/30",
                                    isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                )}
                            />
                        </div>
                        <span className="text-[11px] text-muted-foreground font-medium self-end sm:self-center">
                            العدد المعروض: <b className="text-foreground font-mono">{filtered.length}</b> من أصل <b className="text-foreground font-mono">{records.length}</b>
                        </span>
                    </div>

                    {/* List */}
                    {isLoading ? (
                        <div className="p-8 text-center text-muted-foreground text-xs flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                            <span>جاري جلب كتب الاستمرارية...</span>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground text-xs">
                            لا توجد كتب تأييد استمرارية مطابقة للبحث
                        </div>
                    ) : (
                        <div className="divide-y divide-border border rounded-xl overflow-hidden max-h-[380px] overflow-y-auto">
                            {filtered.map(item => (
                                <div
                                    key={item.id}
                                    className={cn(
                                        "p-3 flex flex-col md:flex-row md:items-center justify-between gap-2.5 transition-colors",
                                        isDark ? "hover:bg-slate-800/50" : "hover:bg-slate-50"
                                    )}
                                >
                                    <div className="space-y-1 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-bold text-xs text-blue-600 dark:text-blue-400 font-mono">
                                                {item.official_letter_number || 'بدون رقم صادر'}
                                            </span>
                                            <span className="text-[11px] text-muted-foreground font-mono flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {item.official_letter_date || item.created_at?.split('T')[0]}
                                            </span>
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                معتمد ومُسلّم
                                            </span>
                                        </div>

                                        <div className="flex flex-wrap sm:flex-nowrap items-baseline gap-2 text-xs">
                                            <span className="font-bold text-foreground">
                                                {item.employee?.full_name || 'موظف'}
                                            </span>
                                            <span className="text-muted-foreground text-[11px]">
                                                (رقم وظيفي: {item.employee?.job_number || '—'})
                                            </span>
                                            <span className="hidden sm:inline text-muted-foreground/40">•</span>
                                            <span className="text-muted-foreground text-[11px] flex items-center gap-1">
                                                <Building className="w-3 h-3 text-emerald-500" />
                                                معنون إلى: <b className="text-foreground/80">{item.destination_entity}</b>
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => onSelect(item)}
                                            className={cn(
                                                "px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all",
                                                isDark ? "border-slate-700 bg-slate-800 hover:bg-slate-700" : "border-slate-200 bg-slate-100 hover:bg-slate-200"
                                            )}
                                        >
                                            <Printer className="w-3.5 h-3.5 text-blue-500" />
                                            <span>معاينة وطباعة الكتاب</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
