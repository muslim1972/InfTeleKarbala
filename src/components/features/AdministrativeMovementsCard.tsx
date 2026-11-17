import { useState, useEffect, useRef, useCallback } from "react";
import { Award, Users, AlertTriangle, Calendar, Loader2, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { cn } from "../../lib/utils";

interface AdministrativeMovementsCardProps {
    userId: string;
}

type MovementType = 'thanks' | 'committees' | 'penalties';

interface MovementItem {
    id: string;
    title: string;
    bookNumber: string;
    date: string;
    details?: string;
    extra?: string;
    raw: any;
}

export const AdministrativeMovementsCard = ({ userId }: AdministrativeMovementsCardProps) => {
    // Current date helpers
    const currentYear = new Date().getFullYear();
    const [startDate, setStartDate] = useState<string>(`${currentYear - 1}-01-01`);
    const [endDate, setEndDate] = useState<string>(`${currentYear}-12-31`);
    const [activeType, setActiveType] = useState<MovementType>('thanks');
    const [loading, setLoading] = useState<boolean>(false);
    const [items, setItems] = useState<MovementItem[]>([]);
    const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);

    const fetchMovements = useCallback(async (type: MovementType, fromDate: string, toDate: string) => {
        if (!userId) return;
        setLoading(true);
        setExpandedItemId(null);

        try {
            let data: any[] = [];

            if (type === 'thanks') {
                let query = supabase
                    .from('thanks_details')
                    .select('*')
                    .eq('user_id', userId);

                if (fromDate) query = query.gte('book_date', fromDate);
                if (toDate) query = query.lte('book_date', toDate);

                const res = await query.order('book_date', { ascending: false });
                data = (res.data || []).map((row) => ({
                    id: row.id,
                    title: row.issuer ? `${row.issuer}${row.reason ? ` - ${row.reason}` : ''}` : (row.reason || 'كتاب شكر وتقدير'),
                    bookNumber: row.book_number || '—',
                    date: row.book_date || (row.year ? String(row.year) : '—'),
                    details: row.reason,
                    extra: row.issuer ? `الجهة المانحة: ${row.issuer}` : undefined,
                    raw: row
                }));
            } else if (type === 'committees') {
                let query = supabase
                    .from('committees_details')
                    .select('*')
                    .eq('user_id', userId);

                if (fromDate) query = query.gte('start_date', fromDate);
                if (toDate) query = query.lte('start_date', toDate);

                const res = await query.order('start_date', { ascending: false });
                data = (res.data || []).map((row) => ({
                    id: row.id,
                    title: row.committee_name || 'لجنة إدارية',
                    bookNumber: row.book_number || (row.role ? `الصفة: ${row.role}` : '—'),
                    date: row.start_date || (row.year ? String(row.year) : '—'),
                    details: row.role ? `الدور / الصفة: ${row.role}` : undefined,
                    extra: row.book_number ? `رقم الأمر: ${row.book_number}` : undefined,
                    raw: row
                }));
            } else if (type === 'penalties') {
                let query = supabase
                    .from('penalties_details')
                    .select('*')
                    .eq('user_id', userId);

                if (fromDate) query = query.gte('penalty_date', fromDate);
                if (toDate) query = query.lte('penalty_date', toDate);

                const res = await query.order('penalty_date', { ascending: false });
                data = (res.data || []).map((row) => ({
                    id: row.id,
                    title: row.penalty_type || 'عقوبة إدارية',
                    bookNumber: row.book_number || (row.reason ? `السبب: ${row.reason}` : '—'),
                    date: row.penalty_date || (row.year ? String(row.year) : '—'),
                    details: row.reason ? `السبب: ${row.reason}` : undefined,
                    extra: row.effect ? `الأثر المترتب: ${row.effect}` : undefined,
                    raw: row
                }));
            }

            setItems(data);
        } catch (error) {
            console.error("Error fetching movements:", error);
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        fetchMovements(activeType, startDate, endDate);
    }, [activeType, startDate, endDate, fetchMovements]);

    const toggleItemExpand = (id: string) => {
        setExpandedItemId(prev => prev === id ? null : id);
    };

    return (
        <div className="space-y-3.5">
            {/* أفقياً: حقول التاريخ من / إلى */}
            <div className="grid grid-cols-2 gap-2.5 bg-muted/30 p-2.5 rounded-xl border border-border/50">
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-primary" />
                        من تاريخ:
                    </label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full bg-background border border-input rounded-lg px-2.5 py-1.5 text-xs font-mono font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-primary" />
                        إلى تاريخ:
                    </label>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full bg-background border border-input rounded-lg px-2.5 py-1.5 text-xs font-mono font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                    />
                </div>
            </div>

            {/* شريط أفقي بثلاثة أزرار: كتب الشكر / اللجان / العقوبات */}
            <div className="grid grid-cols-3 gap-2">
                <button
                    type="button"
                    onClick={() => setActiveType('thanks')}
                    className={cn(
                        "flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all border",
                        activeType === 'thanks'
                            ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40 shadow-sm ring-1 ring-amber-500/30"
                            : "bg-muted/40 hover:bg-muted text-muted-foreground border-transparent hover:text-foreground"
                    )}
                >
                    <Award className="w-4 h-4 shrink-0" />
                    <span>كتب الشكر</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveType('committees')}
                    className={cn(
                        "flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all border",
                        activeType === 'committees'
                            ? "bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/40 shadow-sm ring-1 ring-blue-500/30"
                            : "bg-muted/40 hover:bg-muted text-muted-foreground border-transparent hover:text-foreground"
                    )}
                >
                    <Users className="w-4 h-4 shrink-0" />
                    <span>اللجان</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveType('penalties')}
                    className={cn(
                        "flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all border",
                        activeType === 'penalties'
                            ? "bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/40 shadow-sm ring-1 ring-red-500/30"
                            : "bg-muted/40 hover:bg-muted text-muted-foreground border-transparent hover:text-foreground"
                    )}
                >
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>العقوبات</span>
                </button>
            </div>

            {/* الحاوية التي تستوعب خمسة أسطر (ارتفاع ثابت مريح 220px يمتلئ بـ 5 أسطر بالضبط وسكرول عند الزيادة والكيبورد) */}
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                {/* ترويسة الأعمدة الثابتة */}
                <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted/60 border-b border-border text-[11px] font-bold text-muted-foreground select-none">
                    <div className="col-span-5 text-right">الاسم / البيان</div>
                    <div className="col-span-4 text-center">رقم الكتاب / الصفة</div>
                    <div className="col-span-3 text-left">التاريخ</div>
                </div>

                {/* الحاوية المربعة القابلة للتمرير مع دعم الكيبورد */}
                <div
                    ref={containerRef}
                    tabIndex={0}
                    aria-label="قائمة الحركات الإدارية"
                    className="h-[220px] max-h-[220px] overflow-y-auto outline-none focus:ring-1 focus:ring-primary/40 divide-y divide-border/40 custom-scrollbar select-text"
                >
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                            <span className="text-xs">جاري تحميل السجلات...</span>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center gap-1.5 text-muted-foreground p-4 text-center">
                            <FileText className="w-8 h-8 stroke-1 text-muted-foreground/40" />
                            <p className="text-xs font-medium">لا توجد سجلات مسجلة ضمن هذه الفترة</p>
                            <span className="text-[10px] text-muted-foreground/60">اختر فترة زمنية أخرى أو نوع حركة آخر</span>
                        </div>
                    ) : (
                        items.map((item) => {
                            const isExpanded = expandedItemId === item.id;
                            const hasExtra = Boolean(item.details || item.extra);

                            return (
                                <div
                                    key={item.id}
                                    className={cn(
                                        "transition-colors",
                                        hasExtra ? "cursor-pointer hover:bg-muted/30" : "",
                                        isExpanded ? "bg-muted/40" : ""
                                    )}
                                    onClick={() => hasExtra && toggleItemExpand(item.id)}
                                >
                                    {/* السطر الأساسي بارتفاع 44px بالضبط */}
                                    <div className="h-[44px] grid grid-cols-12 gap-2 px-3 items-center text-xs">
                                        <div className="col-span-5 font-bold text-foreground truncate flex items-center gap-1" title={item.title}>
                                            <span className="truncate">{item.title}</span>
                                            {hasExtra && (
                                                <span className="text-muted-foreground shrink-0">
                                                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                </span>
                                            )}
                                        </div>
                                        <div className="col-span-4 font-mono font-medium text-center text-foreground/80 truncate px-1" title={item.bookNumber}>
                                            {item.bookNumber}
                                        </div>
                                        <div className="col-span-3 font-mono text-left text-muted-foreground truncate dir-ltr">
                                            {item.date}
                                        </div>
                                    </div>

                                    {/* تفاصيل إضافية مدمجة قابلة للتوسيع */}
                                    {isExpanded && hasExtra && (
                                        <div className="px-3 pb-2 pt-0 text-[11px] text-muted-foreground space-y-0.5 border-t border-dashed border-border/40 bg-muted/20">
                                            {item.details && <p className="leading-relaxed">{item.details}</p>}
                                            {item.extra && <p className="font-semibold text-foreground/70">{item.extra}</p>}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};
