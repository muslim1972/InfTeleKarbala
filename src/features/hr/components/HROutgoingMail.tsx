import { useState } from 'react';
import { Send, Plus, Search, Printer, FileText, Clock, X, Calendar, RotateCcw } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { cn } from '../../../lib/utils';
import type { OutgoingMailItem } from '../types';

const INITIAL_OUTGOING_DATA: OutgoingMailItem[] = [
    {
        id: 'out-1',
        mailNumber: 'ص/2026/142',
        mailDate: '2026-10-24',
        recipient: 'الشركة العامة للاتصالات والمعلوماتية / قسم الموارد البشرية',
        subject: 'موقف الإجازات والغيابات لشهر تشرين الأول 2026',
        category: 'official_letter',
        priority: 'urgent',
        signatoryName: 'د. علي عباس جاسم الصباغ',
        signatoryTitle: 'مدير المديرية',
        attachmentsCount: 3,
        status: 'issued',
        notes: 'مرفق جدول تفصيلي بأسماء المجازين والمناوبين',
        createdAt: '2026-10-24T09:30:00Z'
    },
    {
        id: 'out-2',
        mailNumber: 'ص/2026/141',
        mailDate: '2026-10-22',
        recipient: 'مصرف الرافدين / فرع كربلاء',
        subject: 'تأييد استمرارية بالخدمة للموظف (كرار حيدر جاسم)',
        category: 'endorsement',
        priority: 'normal',
        signatoryName: 'د. علي عباس جاسم الصباغ',
        signatoryTitle: 'مدير المديرية',
        attachmentsCount: 0,
        status: 'issued',
        notes: 'لأغراض استكمال منح السلفة',
        createdAt: '2026-10-22T11:15:00Z'
    },
    {
        id: 'out-3',
        mailNumber: 'ص/2026/140',
        mailDate: '2026-10-20',
        recipient: 'كافة الأقسام والشعب في مديرية اتصالات كربلاء',
        subject: 'إعمام / الالتزام بساعات الدوام الرسمي وتوقيتات البصمة',
        category: 'circular',
        priority: 'urgent',
        signatoryName: 'د. علي عباس جاسم الصباغ',
        signatoryTitle: 'مدير المديرية',
        attachmentsCount: 1,
        status: 'issued',
        notes: 'التأكيد على العمل وفق تعليمات الوزارة وضوابط البصمة البيومترية',
        createdAt: '2026-10-20T08:00:00Z'
    },
    {
        id: 'out-4',
        mailNumber: 'ص/2026/139',
        mailDate: '2026-10-18',
        recipient: 'محافظة كربلاء المقدسة / مكتب المحافظ',
        subject: 'بيان الموقف الفني لتوسعة شبكة الألياف الضوئية للمشاريع الاستثمارية',
        category: 'official_letter',
        priority: 'urgent',
        signatoryName: 'د. علي عباس جاسم الصباغ',
        signatoryTitle: 'مدير المديرية',
        attachmentsCount: 2,
        status: 'issued',
        notes: 'إجابة على كتاب المحافظة ذي العدد 1245 في 2026-10-12',
        createdAt: '2026-10-18T10:00:00Z'
    },
    {
        id: 'out-5',
        mailNumber: 'ص/2026/138',
        mailDate: '2026-10-14',
        recipient: 'مصرف الرشيد / فرع الأنصار',
        subject: 'تأييد استمرارية بالخدمة للموظف (أسيل جبار عبد السادة)',
        category: 'endorsement',
        priority: 'normal',
        signatoryName: 'د. علي عباس جاسم الصباغ',
        signatoryTitle: 'مدير المديرية',
        attachmentsCount: 0,
        status: 'issued',
        notes: 'لأغراض المعاملة المصرفية',
        createdAt: '2026-10-14T09:15:00Z'
    },
    {
        id: 'out-6',
        mailNumber: 'ص/2026/137',
        mailDate: '2026-10-08',
        recipient: 'الشركة العامة للاتصالات / قسم الشؤون الهندسية',
        subject: 'محضر إتلاف واستبدال كوابل ضوئية متضررة في بدالة العباس',
        category: 'official_letter',
        priority: 'normal',
        signatoryName: 'د. علي عباس جاسم الصباغ',
        signatoryTitle: 'مدير المديرية',
        attachmentsCount: 4,
        status: 'issued',
        notes: 'مع طيّه الكشف التخميني المصدق من لجنة الفحص',
        createdAt: '2026-10-08T12:00:00Z'
    }
];

export const HROutgoingMail = () => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [items, setItems] = useState<OutgoingMailItem[]>(INITIAL_OUTGOING_DATA);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [priorityFilter, setPriorityFilter] = useState<string>('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<OutgoingMailItem | null>(null);

    // Form state
    const [mailNumber, setMailNumber] = useState(`ص/2026/${items.length + 143}`);
    const [mailDate, setMailDate] = useState(new Date().toISOString().split('T')[0]);
    const [recipient, setRecipient] = useState('');
    const [subject, setSubject] = useState('');
    const [category, setCategory] = useState<OutgoingMailItem['category']>('official_letter');
    const [priority, setPriority] = useState<OutgoingMailItem['priority']>('normal');
    const [signatoryName, setSignatoryName] = useState('د. علي عباس جاسم الصباغ');
    const [signatoryTitle, setSignatoryTitle] = useState('مدير المديرية');
    const [attachmentsCount, setAttachmentsCount] = useState<number>(0);
    const [notes, setNotes] = useState('');

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!mailNumber || !recipient || !subject) return;

        const newItem: OutgoingMailItem = {
            id: `out-${Date.now()}`,
            mailNumber,
            mailDate,
            recipient,
            subject,
            category,
            priority,
            signatoryName,
            signatoryTitle,
            attachmentsCount,
            status: 'issued',
            notes,
            createdAt: new Date().toISOString()
        };

        setItems([newItem, ...items]);
        setIsCreateModalOpen(false);
        // Reset form
        setMailNumber(`ص/2026/${items.length + 144}`);
        setRecipient('');
        setSubject('');
        setNotes('');
        setAttachmentsCount(0);
    };

    const filteredItems = items.filter(item => {
        const matchesSearch =
            item.mailNumber.includes(searchTerm) ||
            item.recipient.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.subject.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
        const matchesPriority = priorityFilter === 'all' || item.priority === priorityFilter;
        const matchesDate =
            (!startDate || item.mailDate >= startDate) &&
            (!endDate || item.mailDate <= endDate);
        return matchesSearch && matchesCategory && matchesPriority && matchesDate;
    });

    const getCategoryBadge = (cat: OutgoingMailItem['category']) => {
        switch (cat) {
            case 'admin_order':
                return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">أمر إداري</span>;
            case 'circular':
                return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">إعمام رسمي</span>;
            case 'endorsement':
                return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">تأييد استمرارية</span>;
            case 'internal_memo':
                return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">مذكرة داخلية</span>;
            default:
                return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">كتاب رسمي</span>;
        }
    };

    const getPriorityBadge = (pri: OutgoingMailItem['priority']) => {
        switch (pri) {
            case 'urgent':
                return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">عاجل</span>;
            case 'top_urgent':
                return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 animate-pulse">عاجل جداً</span>;
            case 'confidential':
                return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-500/15 text-red-600 dark:text-red-400">سري وشخصي</span>;
            default:
                return <span className="px-2 py-0.5 rounded-full text-[11px] font-medium text-slate-500 dark:text-slate-400">عادي</span>;
        }
    };

    return (
        <div className="space-y-5 animate-in fade-in duration-300">
            {/* Header / Summary Card */}
            <div className={cn(
                "p-5 rounded-2xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4",
                isDark ? "bg-slate-900/60 border-slate-800 backdrop-blur-md" : "bg-white border-slate-200 shadow-sm"
            )}>
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center text-white shadow-lg shadow-rose-500/20">
                        <Send className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold">سجل الكتب الصادرة</h2>
                        <p className="text-xs text-muted-foreground">توثيق وإصدار المراسلات الرسمية والكتب ذات الأرقام الصادرة</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition-all active:scale-95"
                    >
                        <Plus className="w-4 h-4" />
                        <span>إصدار كتاب صادر جديد</span>
                    </button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className={cn("p-4 rounded-xl border", isDark ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200")}>
                    <span className="text-xs text-muted-foreground block mb-1">الكتب الصادرة لسنة {new Date().getFullYear()}</span>
                    <span className="text-xl font-bold text-rose-600 dark:text-rose-400 font-mono">{items.length} كتاباً</span>
                </div>
                <div className={cn("p-4 rounded-xl border", isDark ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200")}>
                    <span className="text-xs text-muted-foreground block mb-1">صادر هذا الشهر</span>
                    <span className="text-xl font-bold text-blue-600 dark:text-blue-400 font-mono">{items.length}</span>
                </div>
                <div className={cn("p-4 rounded-xl border", isDark ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200")}>
                    <span className="text-xs text-muted-foreground block mb-1">الكتب العاجلة</span>
                    <span className="text-xl font-bold text-amber-600 dark:text-amber-400 font-mono">
                        {items.filter(i => i.priority === 'urgent' || i.priority === 'top_urgent').length}
                    </span>
                </div>
                <div className={cn("p-4 rounded-xl border", isDark ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200")}>
                    <span className="text-xs text-muted-foreground block mb-1">تأييدات الاستمرارية</span>
                    <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                        {items.filter(i => i.category === 'endorsement').length}
                    </span>
                </div>
            </div>

            {/* Filters & Search & Date Range (المنطقة 1) */}
            <div className={cn(
                "p-3.5 rounded-2xl border space-y-3",
                isDark ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200 shadow-sm"
            )}>
                {/* Search & Type/Priority selects */}
                <div className="flex flex-col md:flex-row gap-2.5">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="ابحث برقم الصادر، الموضوع، أو الجهة المرسل إليها..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={cn(
                                "w-full pr-9 pl-4 py-2 text-xs rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-rose-500/30",
                                isDark ? "bg-slate-800/80 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                            )}
                        />
                    </div>
                    <div className="flex flex-wrap sm:flex-nowrap gap-2">
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className={cn(
                                "px-3 py-2 text-xs rounded-xl border transition-all focus:outline-none font-medium",
                                isDark ? "bg-slate-800/80 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                            )}
                        >
                            <option value="all">كل الأنواع</option>
                            <option value="official_letter">كتاب رسمي</option>
                            <option value="admin_order">أمر إداري</option>
                            <option value="circular">إعمام</option>
                            <option value="endorsement">تأييد استمرارية</option>
                            <option value="internal_memo">مذكرة داخلية</option>
                        </select>

                        <select
                            value={priorityFilter}
                            onChange={(e) => setPriorityFilter(e.target.value)}
                            className={cn(
                                "px-3 py-2 text-xs rounded-xl border transition-all focus:outline-none font-medium",
                                isDark ? "bg-slate-800/80 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                            )}
                        >
                            <option value="all">كل الأسبقيات</option>
                            <option value="normal">عادي</option>
                            <option value="urgent">عاجل</option>
                            <option value="top_urgent">عاجل جداً</option>
                            <option value="confidential">سري وشخصي</option>
                        </select>
                    </div>
                </div>

                {/* Date Range Filter (منطقة 1 - سحب الكتب لفترة معينة) */}
                <div className={cn(
                    "pt-2.5 border-t flex flex-wrap items-center justify-between gap-2.5 text-xs",
                    isDark ? "border-slate-800" : "border-slate-100"
                )}>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5 text-muted-foreground font-bold">
                            <Calendar className="w-3.5 h-3.5 text-rose-500" />
                            <span>سحب الكتب لفترة محددة:</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-muted-foreground font-medium">من تاريخ:</span>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className={cn(
                                    "px-2.5 py-1.5 rounded-lg border text-xs focus:outline-none focus:ring-1 focus:ring-rose-500 font-mono",
                                    isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                )}
                            />
                        </div>

                        <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-muted-foreground font-medium">إلى تاريخ:</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className={cn(
                                    "px-2.5 py-1.5 rounded-lg border text-xs focus:outline-none focus:ring-1 focus:ring-rose-500 font-mono",
                                    isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                )}
                            />
                        </div>

                        {(startDate || endDate) && (
                            <button
                                type="button"
                                onClick={() => { setStartDate(''); setEndDate(''); }}
                                className="px-2 py-1 rounded-lg border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 text-[11px] font-bold flex items-center gap-1 transition-colors"
                                title="إلغاء تصفية التاريخ"
                            >
                                <RotateCcw className="w-3 h-3" />
                                <span>إعادة تعيين الفترة</span>
                            </button>
                        )}
                    </div>

                    <div className="text-[11px] text-muted-foreground font-medium">
                        النتائج المعروضة: <span className="font-bold text-foreground font-mono">{filteredItems.length}</span> كتاب
                    </div>
                </div>
            </div>

            {/* List / Table (المنطقة 2 - قائمة بحاوية تظهر 4 كتب مع سكرول) */}
            <div className={cn(
                "rounded-2xl border overflow-hidden flex flex-col",
                isDark ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200 shadow-sm"
            )}>
                {/* List Header */}
                <div className={cn(
                    "px-4 py-2.5 border-b flex items-center justify-between text-xs font-bold",
                    isDark ? "bg-slate-800/40 border-slate-800 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-700"
                )}>
                    <div className="flex items-center gap-2">
                        <Send className="w-3.5 h-3.5 text-rose-500" />
                        <span>قائمة الكتب الصادرة (عرض مدمج)</span>
                    </div>
                    <span className="text-[11px] font-normal text-muted-foreground">
                        حاوية تتسع لـ 4 كتب مع شريط تمرير (سكرول)
                    </span>
                </div>

                {filteredItems.length === 0 ? (
                    <div className="p-10 text-center text-muted-foreground text-xs">
                        لا توجد كتب صادرة مطابقة لخيارات البحث أو الفترة المحددة
                    </div>
                ) : (
                    <div className="max-h-[295px] overflow-y-auto divide-y divide-border">
                        {filteredItems.map(item => (
                            <div
                                key={item.id}
                                className={cn(
                                    "px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors hover:bg-rose-500/5",
                                    isDark ? "hover:bg-rose-500/10" : ""
                                )}
                            >
                                <div className="space-y-1 flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-bold text-xs text-rose-600 dark:text-rose-400 font-mono">
                                            {item.mailNumber}
                                        </span>
                                        <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                                            <Clock className="w-3 h-3" />
                                            {item.mailDate}
                                        </span>
                                        {getCategoryBadge(item.category)}
                                        {getPriorityBadge(item.priority)}
                                    </div>

                                    <div className="flex flex-wrap sm:flex-nowrap items-baseline gap-2">
                                        <h3 className="font-bold text-xs text-foreground truncate max-w-md">{item.subject}</h3>
                                        <span className="hidden sm:inline text-muted-foreground/40">•</span>
                                        <p className="text-[11px] text-muted-foreground truncate">
                                            <span className="font-medium text-foreground/70">الجهة:</span> {item.recipient}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                                    <button
                                        onClick={() => setSelectedItem(item)}
                                        className={cn(
                                            "px-2.5 py-1 rounded-lg border text-xs font-bold flex items-center gap-1 transition-all",
                                            isDark ? "border-slate-700 bg-slate-800 hover:bg-slate-700" : "border-slate-200 bg-slate-100 hover:bg-slate-200"
                                        )}
                                        title="معاينة تفاصيل الكتاب"
                                    >
                                        <FileText className="w-3 h-3 text-blue-500" />
                                        <span>معاينة</span>
                                    </button>
                                    <button
                                        onClick={() => window.print()}
                                        className={cn(
                                            "px-2.5 py-1 rounded-lg border text-xs font-bold flex items-center gap-1 transition-all",
                                            isDark ? "border-slate-700 bg-slate-800 hover:bg-slate-700" : "border-slate-200 bg-slate-100 hover:bg-slate-200"
                                        )}
                                        title="طباعة"
                                    >
                                        <Printer className="w-3 h-3 text-emerald-500" />
                                        <span>طباعة</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* List Footer */}
                <div className={cn(
                    "px-4 py-2 border-t flex items-center justify-between text-[11px] text-muted-foreground",
                    isDark ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"
                )}>
                    <span>إجمالي الكتب: <b className="text-foreground font-mono">{filteredItems.length}</b></span>
                    {filteredItems.length > 4 && (
                        <span className="text-rose-500 font-medium">
                            يوجد {filteredItems.length - 4} كتب إضافية — حرّك بالسكرول لعرضها
                        </span>
                    )}
                </div>
            </div>

            {/* Modal: New Outgoing Book */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pt-16 sm:pt-20 pb-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className={cn(
                        "w-full max-w-2xl rounded-2xl border shadow-2xl p-6 relative max-h-[calc(100vh-5.5rem)] flex flex-col my-auto overflow-hidden",
                        isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"
                    )}>
                        <div className="flex items-center justify-between pb-4 border-b border-border mb-4 shrink-0">
                            <div className="flex items-center gap-2">
                                <Send className="w-5 h-5 text-rose-500" />
                                <h3 className="font-bold text-base">إصدار كتاب رسمي صادر جديد</h3>
                            </div>
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreate} className="space-y-4 text-xs overflow-y-auto pr-1 flex-1">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold mb-1">رقم الصادر *</label>
                                    <input
                                        type="text"
                                        required
                                        value={mailNumber}
                                        onChange={(e) => setMailNumber(e.target.value)}
                                        className={cn(
                                            "w-full p-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-rose-500/30",
                                            isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                        )}
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold mb-1">تاريخ الإصدار *</label>
                                    <input
                                        type="date"
                                        required
                                        value={mailDate}
                                        onChange={(e) => setMailDate(e.target.value)}
                                        className={cn(
                                            "w-full p-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-rose-500/30",
                                            isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                        )}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold mb-1">نوع الكتاب *</label>
                                    <select
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value as any)}
                                        className={cn(
                                            "w-full p-2.5 rounded-xl border focus:outline-none",
                                            isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                        )}
                                    >
                                        <option value="official_letter">كتاب رسمي</option>
                                        <option value="admin_order">أمر إداري</option>
                                        <option value="circular">إعمام رسمي</option>
                                        <option value="endorsement">تأييد استمرارية بالخدمة</option>
                                        <option value="internal_memo">مذكرة داخلية</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block font-bold mb-1">درجة الأسبقية</label>
                                    <select
                                        value={priority}
                                        onChange={(e) => setPriority(e.target.value as any)}
                                        className={cn(
                                            "w-full p-2.5 rounded-xl border focus:outline-none",
                                            isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                        )}
                                    >
                                        <option value="normal">عادي</option>
                                        <option value="urgent">عاجل</option>
                                        <option value="top_urgent">عاجل جداً</option>
                                        <option value="confidential">سري وشخصي</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold mb-1">إلى / الجهة الموجه إليها الكتاب *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="مثال: الشركة العامة للاتصالات والمعلوماتية / قسم الشؤون المالية"
                                    value={recipient}
                                    onChange={(e) => setRecipient(e.target.value)}
                                    className={cn(
                                        "w-full p-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-rose-500/30",
                                        isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                    )}
                                />
                            </div>

                            <div>
                                <label className="block font-bold mb-1">موضوع الكتاب *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="مثال: إرسال الموقف الشهري للإجازات"
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    className={cn(
                                        "w-full p-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-rose-500/30",
                                        isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                    )}
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block font-bold mb-1">الموقّع</label>
                                    <input
                                        type="text"
                                        value={signatoryName}
                                        onChange={(e) => setSignatoryName(e.target.value)}
                                        className={cn(
                                            "w-full p-2.5 rounded-xl border focus:outline-none",
                                            isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                        )}
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold mb-1">صفة الموقّع</label>
                                    <input
                                        type="text"
                                        value={signatoryTitle}
                                        onChange={(e) => setSignatoryTitle(e.target.value)}
                                        className={cn(
                                            "w-full p-2.5 rounded-xl border focus:outline-none",
                                            isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                        )}
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold mb-1">عدد المرفقات</label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={attachmentsCount}
                                        onChange={(e) => setAttachmentsCount(parseInt(e.target.value) || 0)}
                                        className={cn(
                                            "w-full p-2.5 rounded-xl border focus:outline-none",
                                            isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                        )}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold mb-1">ملاحظات أو خلاصة النص</label>
                                <textarea
                                    rows={3}
                                    placeholder="اكتب خلاصة توجيه الكتاب أو الملاحظات الخاصة بالإرسال..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className={cn(
                                        "w-full p-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-rose-500/30",
                                        isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                    )}
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t border-border shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-4 py-2 rounded-xl border hover:bg-secondary font-bold text-xs"
                                >
                                    إلغاء
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20"
                                >
                                    حفظ وإصدار الكتاب
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: View Details */}
            {selectedItem && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pt-16 sm:pt-20 pb-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className={cn(
                        "w-full max-w-lg rounded-2xl border shadow-2xl p-6 relative max-h-[calc(100vh-5.5rem)] flex flex-col my-auto overflow-hidden",
                        isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"
                    )}>
                        <div className="flex items-center justify-between pb-3 border-b border-border mb-4 shrink-0">
                            <span className="font-bold text-base text-rose-600 dark:text-rose-400 font-mono">
                                {selectedItem.mailNumber}
                            </span>
                            <button
                                onClick={() => setSelectedItem(null)}
                                className="p-1 rounded-lg hover:bg-secondary"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-3 text-xs overflow-y-auto pr-1 flex-1">
                            <div>
                                <span className="text-muted-foreground block text-[11px]">الموضوع:</span>
                                <p className="font-bold text-sm mt-0.5">{selectedItem.subject}</p>
                            </div>
                            <div>
                                <span className="text-muted-foreground block text-[11px]">الجهة المرسل إليها:</span>
                                <p className="font-medium mt-0.5">{selectedItem.recipient}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <span className="text-muted-foreground block text-[11px]">تاريخ الصادر:</span>
                                    <p className="font-medium mt-0.5 font-mono">{selectedItem.mailDate}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-[11px]">الأسبقية:</span>
                                    <div className="mt-0.5">{getPriorityBadge(selectedItem.priority)}</div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <span className="text-muted-foreground block text-[11px]">الموقّع:</span>
                                    <p className="font-medium mt-0.5">{selectedItem.signatoryName} ({selectedItem.signatoryTitle})</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-[11px]">المرفقات:</span>
                                    <p className="font-medium mt-0.5">{selectedItem.attachmentsCount} مرفق</p>
                                </div>
                            </div>
                            {selectedItem.notes && (
                                <div>
                                    <span className="text-muted-foreground block text-[11px]">الملاحظات:</span>
                                    <p className="font-medium mt-0.5 p-2 rounded-lg bg-secondary/50">{selectedItem.notes}</p>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 pt-4 border-t border-border mt-4 shrink-0">
                            <button
                                onClick={() => window.print()}
                                className="px-4 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-md"
                            >
                                <Printer className="w-4 h-4" />
                                <span>طباعة السجل</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
