import { useState } from 'react';
import { Inbox, Plus, Search, Printer, FileText, Clock, X } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { cn } from '../../../lib/utils';
import type { IncomingMailItem } from '../types';

const INITIAL_INCOMING_DATA: IncomingMailItem[] = [
    {
        id: 'in-1',
        incomingNumber: 'و/2026/89',
        incomingDate: '2026-10-24',
        originalNumber: '10/5/9821',
        originalDate: '2026-10-21',
        sender: 'وزارة الاتصالات / مكتب السيد الوزير',
        subject: 'توجيهات بشأن الخطة السنوية لتدريب وتطوير الكوادر الفنية لعام 2027',
        forwardedTo: 'شعبة التدريب الصيفي وشؤون الموظفين',
        requiredAction: 'إبداء الرأي ورفع خطة الاحتياجات التدريبية خلال 7 أيام',
        priority: 'urgent',
        status: 'in_progress',
        attachmentsCount: 2,
        notes: 'مرفق استمارة حصر الاحتياجات',
        createdAt: '2026-10-24T10:00:00Z'
    },
    {
        id: 'in-2',
        incomingNumber: 'و/2026/88',
        incomingDate: '2026-10-23',
        originalNumber: 'هـ/ك/432',
        originalDate: '2026-10-22',
        sender: 'محافظة كربلاء المقدسة / مكتب المحافظ',
        subject: 'تنسيق المسارات الهندسية لمشروع التوسع الضوئي FTTH في الأحياء الغربية',
        forwardedTo: 'قسم الشبكات والتشغيل / شعبة التخطيط',
        requiredAction: 'للعلم والعمل بموجبه وتسمية ممثل ميداني',
        priority: 'normal',
        status: 'new',
        attachmentsCount: 1,
        notes: 'تثبيت موعد الكشف الميداني يوم الأحد',
        createdAt: '2026-10-23T08:45:00Z'
    },
    {
        id: 'in-3',
        incomingNumber: 'و/2026/87',
        incomingDate: '2026-10-18',
        originalNumber: 'م/ب/120',
        originalDate: '2026-10-17',
        sender: 'هيئة التقاعد الوطنية / فرع كربلاء',
        subject: 'استكمال المعاملة التقاعدية للموظف المحال على التقاعد (كاظم كريم عبيد)',
        forwardedTo: 'شعبة الذاتية والموارد البشرية',
        requiredAction: 'تزويد الهيئة بآخر احتساب خدمة وخلاصة الراتب',
        priority: 'urgent',
        status: 'completed',
        attachmentsCount: 0,
        notes: 'تم إعداد الإجابة بالصادر رقم ص/2026/138',
        createdAt: '2026-10-18T12:30:00Z'
    }
];

export const HRIncomingMail = () => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [items, setItems] = useState<IncomingMailItem[]>(INITIAL_INCOMING_DATA);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [priorityFilter, setPriorityFilter] = useState<string>('all');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<IncomingMailItem | null>(null);

    // Form state
    const [incomingNumber, setIncomingNumber] = useState(`و/2026/${items.length + 88}`);
    const [incomingDate, setIncomingDate] = useState(new Date().toISOString().split('T')[0]);
    const [originalNumber, setOriginalNumber] = useState('');
    const [originalDate, setOriginalDate] = useState(new Date().toISOString().split('T')[0]);
    const [sender, setSender] = useState('');
    const [subject, setSubject] = useState('');
    const [forwardedTo, setForwardedTo] = useState('شعبة الذاتية والموارد البشرية');
    const [requiredAction, setRequiredAction] = useState('للعلم والعمل بموجبه');
    const [priority, setPriority] = useState<IncomingMailItem['priority']>('normal');
    const [attachmentsCount, setAttachmentsCount] = useState<number>(0);
    const [notes, setNotes] = useState('');

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!incomingNumber || !sender || !subject) return;

        const newItem: IncomingMailItem = {
            id: `in-${Date.now()}`,
            incomingNumber,
            incomingDate,
            originalNumber,
            originalDate,
            sender,
            subject,
            forwardedTo,
            requiredAction,
            priority,
            status: 'new',
            attachmentsCount,
            notes,
            createdAt: new Date().toISOString()
        };

        setItems([newItem, ...items]);
        setIsCreateModalOpen(false);
        // Reset
        setIncomingNumber(`و/2026/${items.length + 89}`);
        setOriginalNumber('');
        setSender('');
        setSubject('');
        setNotes('');
        setAttachmentsCount(0);
    };

    const handleUpdateStatus = (id: string, newStatus: IncomingMailItem['status']) => {
        setItems(prev => prev.map(item => item.id === id ? { ...item, status: newStatus } : item));
        if (selectedItem && selectedItem.id === id) {
            setSelectedItem(prev => prev ? { ...prev, status: newStatus } : null);
        }
    };

    const filteredItems = items.filter(item => {
        const matchesSearch =
            item.incomingNumber.includes(searchTerm) ||
            item.originalNumber.includes(searchTerm) ||
            item.sender.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.subject.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
        const matchesPriority = priorityFilter === 'all' || item.priority === priorityFilter;
        return matchesSearch && matchesStatus && matchesPriority;
    });

    const getStatusBadge = (st: IncomingMailItem['status']) => {
        switch (st) {
            case 'new':
                return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">وارد جديد</span>;
            case 'in_progress':
                return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">قيد الإجراء</span>;
            case 'completed':
                return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">تم الإنجاز</span>;
            case 'archived':
                return <span className="px-2 py-0.5 rounded-full text-[11px] font-medium text-slate-500 dark:text-slate-400 border border-slate-500/20">مؤرشف</span>;
        }
    };

    const getPriorityBadge = (pri: IncomingMailItem['priority']) => {
        switch (pri) {
            case 'urgent':
                return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">عاجل</span>;
            case 'top_urgent':
                return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 animate-pulse">عاجل جداً</span>;
            case 'confidential':
                return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-500/15 text-red-600 dark:text-red-400">سري</span>;
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
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                        <Inbox className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold">سجل الكتب والبريد الوارد</h2>
                        <p className="text-xs text-muted-foreground">تسجيل وتوثيق المراسلات الواردة من الوزارة والجهات الرسمية وتوزيعها على الأقسام</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition-all active:scale-95"
                    >
                        <Plus className="w-4 h-4" />
                        <span>تسجيل وارد جديد</span>
                    </button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className={cn("p-4 rounded-xl border", isDark ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200")}>
                    <span className="text-xs text-muted-foreground block mb-1">إجمالي الكتب الواردة</span>
                    <span className="text-xl font-bold text-blue-600 dark:text-blue-400">{items.length} كتاباً</span>
                </div>
                <div className={cn("p-4 rounded-xl border", isDark ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200")}>
                    <span className="text-xs text-muted-foreground block mb-1">كتب واردة جديدة</span>
                    <span className="text-xl font-bold text-cyan-600 dark:text-cyan-400">
                        {items.filter(i => i.status === 'new').length}
                    </span>
                </div>
                <div className={cn("p-4 rounded-xl border", isDark ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200")}>
                    <span className="text-xs text-muted-foreground block mb-1">قيد المعالجة</span>
                    <span className="text-xl font-bold text-amber-600 dark:text-amber-400">
                        {items.filter(i => i.status === 'in_progress').length}
                    </span>
                </div>
                <div className={cn("p-4 rounded-xl border", isDark ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200")}>
                    <span className="text-xs text-muted-foreground block mb-1">تم إنجازها</span>
                    <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                        {items.filter(i => i.status === 'completed').length}
                    </span>
                </div>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute right-3 top-3 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="ابحث برقم الوارد، الرقم الأصلي، الموضوع، أو الجهة الوارد منها..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={cn(
                            "w-full pr-9 pl-4 py-2 text-xs rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/30",
                            isDark ? "bg-slate-900/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
                        )}
                    />
                </div>
                <div className="flex gap-2">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className={cn(
                            "px-3 py-2 text-xs rounded-xl border transition-all focus:outline-none",
                            isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
                        )}
                    >
                        <option value="all">كل الحالات</option>
                        <option value="new">وارد جديد</option>
                        <option value="in_progress">قيد المعالجة</option>
                        <option value="completed">منجز</option>
                        <option value="archived">مؤرشف</option>
                    </select>

                    <select
                        value={priorityFilter}
                        onChange={(e) => setPriorityFilter(e.target.value)}
                        className={cn(
                            "px-3 py-2 text-xs rounded-xl border transition-all focus:outline-none",
                            isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
                        )}
                    >
                        <option value="all">كل الأسبقيات</option>
                        <option value="normal">عادي</option>
                        <option value="urgent">عاجل</option>
                        <option value="top_urgent">عاجل جداً</option>
                        <option value="confidential">سري</option>
                    </select>
                </div>
            </div>

            {/* List / Table */}
            <div className={cn(
                "rounded-2xl border overflow-hidden",
                isDark ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200 shadow-sm"
            )}>
                {filteredItems.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground text-sm">
                        لا توجد كتب واردة مطابقة للبحث
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {filteredItems.map(item => (
                            <div
                                key={item.id}
                                className={cn(
                                    "p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors hover:bg-blue-500/5",
                                    isDark ? "hover:bg-blue-500/10" : ""
                                )}
                            >
                                <div className="space-y-1.5 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-bold text-sm text-blue-600 dark:text-blue-400 font-mono">
                                            {item.incomingNumber}
                                        </span>
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            ورود: {item.incomingDate}
                                        </span>
                                        {item.originalNumber && (
                                            <span className="text-[11px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-md font-mono">
                                                أصل: {item.originalNumber} ({item.originalDate})
                                            </span>
                                        )}
                                        {getStatusBadge(item.status)}
                                        {getPriorityBadge(item.priority)}
                                    </div>

                                    <h3 className="font-bold text-sm text-foreground">{item.subject}</h3>

                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                        <p><span className="font-medium text-foreground/80">الوارد من:</span> {item.sender}</p>
                                        <p><span className="font-medium text-foreground/80">محال إلى:</span> {item.forwardedTo}</p>
                                    </div>

                                    <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                                        الإجراء المطلوب: {item.requiredAction}
                                    </p>
                                </div>

                                <div className="flex items-center gap-2 self-end md:self-center">
                                    <button
                                        onClick={() => setSelectedItem(item)}
                                        className={cn(
                                            "px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all",
                                            isDark ? "border-slate-700 bg-slate-800 hover:bg-slate-700" : "border-slate-200 bg-slate-100 hover:bg-slate-200"
                                        )}
                                    >
                                        <FileText className="w-3.5 h-3.5 text-blue-500" />
                                        <span>التفاصيل والإجراء</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal: New Incoming */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className={cn(
                        "w-full max-w-2xl rounded-2xl border shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto",
                        isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"
                    )}>
                        <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
                            <div className="flex items-center gap-2">
                                <Inbox className="w-5 h-5 text-blue-500" />
                                <h3 className="font-bold text-base">تسجيل كتاب رسمي وارد جديد</h3>
                            </div>
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreate} className="space-y-4 text-xs">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold mb-1">رقم الوارد الداخلي *</label>
                                    <input
                                        type="text"
                                        required
                                        value={incomingNumber}
                                        onChange={(e) => setIncomingNumber(e.target.value)}
                                        className={cn(
                                            "w-full p-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/30",
                                            isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                        )}
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold mb-1">تاريخ الورود الفعلي *</label>
                                    <input
                                        type="date"
                                        required
                                        value={incomingDate}
                                        onChange={(e) => setIncomingDate(e.target.value)}
                                        className={cn(
                                            "w-full p-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/30",
                                            isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                        )}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold mb-1">رقم الكتاب الأصلي من الجهة</label>
                                    <input
                                        type="text"
                                        placeholder="الرقم المثبت في صلب الكتاب"
                                        value={originalNumber}
                                        onChange={(e) => setOriginalNumber(e.target.value)}
                                        className={cn(
                                            "w-full p-2.5 rounded-xl border focus:outline-none",
                                            isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                        )}
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold mb-1">تاريخ الكتاب الأصلي</label>
                                    <input
                                        type="date"
                                        value={originalDate}
                                        onChange={(e) => setOriginalDate(e.target.value)}
                                        className={cn(
                                            "w-full p-2.5 rounded-xl border focus:outline-none",
                                            isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                        )}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold mb-1">الجهة الصادر منها الكتاب (المرسِل) *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="مثال: وزارة الاتصالات / الدائرة القانونية"
                                    value={sender}
                                    onChange={(e) => setSender(e.target.value)}
                                    className={cn(
                                        "w-full p-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/30",
                                        isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                    )}
                                />
                            </div>

                            <div>
                                <label className="block font-bold mb-1">موضوع الكتاب *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="خلاصة موجزة لمضمون الكتاب"
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    className={cn(
                                        "w-full p-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/30",
                                        isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                    )}
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold mb-1">جهة الإحالة (القسم / الشعبة المختصة)</label>
                                    <input
                                        type="text"
                                        value={forwardedTo}
                                        onChange={(e) => setForwardedTo(e.target.value)}
                                        className={cn(
                                            "w-full p-2.5 rounded-xl border focus:outline-none",
                                            isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                        )}
                                    />
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
                                        <option value="confidential">سري</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold mb-1">الإجراء المطلوب / تهميش المدير</label>
                                <input
                                    type="text"
                                    placeholder="مثال: للعلم والعمل بموجبه وإعداد إجابة خلال 48 ساعة"
                                    value={requiredAction}
                                    onChange={(e) => setRequiredAction(e.target.value)}
                                    className={cn(
                                        "w-full p-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/30",
                                        isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                    )}
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t border-border">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-4 py-2 rounded-xl border hover:bg-secondary font-bold text-xs"
                                >
                                    إلغاء
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20"
                                >
                                    حفظ وتثبيت الوارد
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: View & Action */}
            {selectedItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className={cn(
                        "w-full max-w-lg rounded-2xl border shadow-2xl p-6 relative",
                        isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"
                    )}>
                        <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
                            <span className="font-bold text-base text-blue-600 dark:text-blue-400 font-mono">
                                {selectedItem.incomingNumber}
                            </span>
                            <button
                                onClick={() => setSelectedItem(null)}
                                className="p-1 rounded-lg hover:bg-secondary"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-3 text-xs">
                            <div>
                                <span className="text-muted-foreground block text-[11px]">الموضوع:</span>
                                <p className="font-bold text-sm mt-0.5">{selectedItem.subject}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <span className="text-muted-foreground block text-[11px]">الجهة المرسلة:</span>
                                    <p className="font-medium mt-0.5">{selectedItem.sender}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-[11px]">جهة الإحالة:</span>
                                    <p className="font-medium mt-0.5">{selectedItem.forwardedTo}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <span className="text-muted-foreground block text-[11px]">رقم وتاريخ الأصل:</span>
                                    <p className="font-mono mt-0.5">{selectedItem.originalNumber || '-'} ({selectedItem.originalDate})</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-[11px]">تاريخ الاستلام:</span>
                                    <p className="font-medium mt-0.5">{selectedItem.incomingDate}</p>
                                </div>
                            </div>
                            <div>
                                <span className="text-muted-foreground block text-[11px]">التوجيه والإجراء المطلوب:</span>
                                <p className="font-medium mt-0.5 p-2 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                                    {selectedItem.requiredAction}
                                </p>
                            </div>

                            <div className="pt-2">
                                <span className="text-muted-foreground block text-[11px] mb-1.5">تحديث حالة المعالجة:</span>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => handleUpdateStatus(selectedItem.id, 'new')}
                                        className={cn("px-2.5 py-1 rounded-lg text-xs font-bold border transition-all", selectedItem.status === 'new' ? "bg-blue-600 text-white border-blue-600" : "hover:bg-secondary")}
                                    >
                                        جديد
                                    </button>
                                    <button
                                        onClick={() => handleUpdateStatus(selectedItem.id, 'in_progress')}
                                        className={cn("px-2.5 py-1 rounded-lg text-xs font-bold border transition-all", selectedItem.status === 'in_progress' ? "bg-amber-600 text-white border-amber-600" : "hover:bg-secondary")}
                                    >
                                        قيد الإجراء
                                    </button>
                                    <button
                                        onClick={() => handleUpdateStatus(selectedItem.id, 'completed')}
                                        className={cn("px-2.5 py-1 rounded-lg text-xs font-bold border transition-all", selectedItem.status === 'completed' ? "bg-emerald-600 text-white border-emerald-600" : "hover:bg-secondary")}
                                    >
                                        تم الإنجاز
                                    </button>
                                    <button
                                        onClick={() => handleUpdateStatus(selectedItem.id, 'archived')}
                                        className={cn("px-2.5 py-1 rounded-lg text-xs font-bold border transition-all", selectedItem.status === 'archived' ? "bg-slate-600 text-white border-slate-600" : "hover:bg-secondary")}
                                    >
                                        أرشفة
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-4 border-t border-border mt-5">
                            <button
                                onClick={() => window.print()}
                                className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-md"
                            >
                                <Printer className="w-4 h-4" />
                                <span>طباعة ورقة الإحالة</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
