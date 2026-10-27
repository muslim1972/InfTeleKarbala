import { useState } from 'react';
import { ScrollText, Plus, Search, Printer, FileText, X, Users } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { cn } from '../../../lib/utils';
import type { AdminOrderItem } from '../types';

const INITIAL_ORDERS: AdminOrderItem[] = [
    {
        id: 'ord-1',
        orderNumber: 'أ.إ/2026/54',
        orderDate: '2026-10-22',
        orderType: 'assignment',
        subject: 'تكليف بمهام مسؤول شعبة المتابعة والتنسيق الفني',
        targetEmployees: ['م. بشير مرتضى مصطفى', 'كرار حيدر جاسم'],
        legalBasis: 'استناداً للصلاحيات المخولة لنا وبناءً على مقتضيات مصلحة العمل',
        orderContent: 'يُكلف الذوات المدرجة أسماؤهم أعلاه بمهام إدارة ومتابعة مشاريع الكابل الضوئي في مركز المحافظة بالإضافة لمهامهم الأصلية.',
        signatory: 'د. علي عباس جاسم الصباغ (مدير المديرية)',
        status: 'active',
        createdAt: '2026-10-22'
    },
    {
        id: 'ord-2',
        orderNumber: 'أ.إ/2026/53',
        orderDate: '2026-10-15',
        orderType: 'committee',
        subject: 'تشكيل لجنة تدقيق وتصفية أرصدة الإجازات المتراكمة لعام 2026',
        targetEmployees: ['أسيل جبار عبد السادة (رئيساً)', 'مسؤول الشؤون المالية (عضواً)', 'مسؤول التدقيق (عضواً)'],
        legalBasis: 'قانون انضباط موظفي الدولة والقطاع العام رقم 14 لسنة 1991 المعدل',
        orderContent: 'تشكل لجنة برئاسة مسؤولة شعبة الموارد البشرية لإجراء جرد وتدقيق شامل لطلبات الإجازات المعتمدة وقطع الإجازات ومطابقتها مع السجلات الإلكترونية.',
        signatory: 'د. علي عباس جاسم الصباغ (مدير المديرية)',
        status: 'active',
        createdAt: '2026-10-15'
    },
    {
        id: 'ord-3',
        orderNumber: 'أ.إ/2026/52',
        orderDate: '2026-10-10',
        orderType: 'appreciation',
        subject: 'توجيه كتاب شكر وتقدير لكادر صيانة الكابلات الضوئية',
        targetEmployees: ['كادر شعبة الشبكات الخارجية'],
        legalBasis: 'مكافأة الجهود الاستثنائية المبذولة في صيانة المسار الرئيسي',
        orderContent: 'نظراً للجهود المتميزة في إصلاح العوارض الفنية بوقت قياسي، تقرر توجيه شكر وتقدير يترتب عليه قدم وظيفي لمدة شهر وفقاً للقانون.',
        signatory: 'د. علي عباس جاسم الصباغ (مدير المديرية)',
        status: 'active',
        createdAt: '2026-10-10'
    }
];

export const HRAdminOrders = () => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [items, setItems] = useState<AdminOrderItem[]>(INITIAL_ORDERS);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<AdminOrderItem | null>(null);

    // Form
    const [orderNumber, setOrderNumber] = useState(`أ.إ/2026/${items.length + 55}`);
    const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
    const [orderType, setOrderType] = useState<AdminOrderItem['orderType']>('assignment');
    const [subject, setSubject] = useState('');
    const [targetEmployeesStr, setTargetEmployeesStr] = useState('');
    const [legalBasis, setLegalBasis] = useState('استناداً للصلاحيات المخولة لنا وبناءً على مقتضيات مصلحة العمل');
    const [orderContent, setOrderContent] = useState('');
    const [signatory, setSignatory] = useState('د. علي عباس جاسم الصباغ (مدير المديرية)');

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!orderNumber || !subject || !orderContent) return;

        const newOrder: AdminOrderItem = {
            id: `ord-${Date.now()}`,
            orderNumber,
            orderDate,
            orderType,
            subject,
            targetEmployees: targetEmployeesStr ? targetEmployeesStr.split(',').map(s => s.trim()) : [],
            legalBasis,
            orderContent,
            signatory,
            status: 'active',
            createdAt: new Date().toISOString().split('T')[0]
        };

        setItems([newOrder, ...items]);
        setIsCreateModalOpen(false);
        setOrderNumber(`أ.إ/2026/${items.length + 56}`);
        setSubject('');
        setTargetEmployeesStr('');
        setOrderContent('');
    };

    const filteredItems = items.filter(item => {
        const matchesSearch =
            item.orderNumber.includes(searchTerm) ||
            item.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.targetEmployees.some(emp => emp.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesType = typeFilter === 'all' || item.orderType === typeFilter;
        return matchesSearch && matchesType;
    });

    const getOrderTypeBadge = (t: AdminOrderItem['orderType']) => {
        switch (t) {
            case 'assignment':
                return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">تكليف / نقل</span>;
            case 'committee':
                return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">تشكيل لجنة</span>;
            case 'appreciation':
                return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">شكر وتقدير</span>;
            case 'penalty':
                return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">عقوبة انضباطية</span>;
            case 'promotion':
                return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">ترفيع / علاوة</span>;
            default:
                return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-500/10 text-slate-600 border">أمر إداري</span>;
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
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
                        <ScrollText className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold">سجل الأوامر الإدارية</h2>
                        <p className="text-xs text-muted-foreground">إصدار وأرشفة الأوامر الإدارية الخاصة بالموظفين وتشكيل اللجان والتكليفات</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-600/20 transition-all active:scale-95"
                    >
                        <Plus className="w-4 h-4" />
                        <span>صياغة أمر إداري جديد</span>
                    </button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className={cn("p-4 rounded-xl border", isDark ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200")}>
                    <span className="text-xs text-muted-foreground block mb-1">إجمالي الأوامر الإدارية</span>
                    <span className="text-xl font-bold text-purple-600 dark:text-purple-400">{items.length} أمراً</span>
                </div>
                <div className={cn("p-4 rounded-xl border", isDark ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200")}>
                    <span className="text-xs text-muted-foreground block mb-1">تشكيل لجان</span>
                    <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                        {items.filter(i => i.orderType === 'committee').length}
                    </span>
                </div>
                <div className={cn("p-4 rounded-xl border", isDark ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200")}>
                    <span className="text-xs text-muted-foreground block mb-1">تكليفات وتنسيب</span>
                    <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                        {items.filter(i => i.orderType === 'assignment').length}
                    </span>
                </div>
                <div className={cn("p-4 rounded-xl border", isDark ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200")}>
                    <span className="text-xs text-muted-foreground block mb-1">شكر وتقدير</span>
                    <span className="text-xl font-bold text-amber-600 dark:text-amber-400">
                        {items.filter(i => i.orderType === 'appreciation').length}
                    </span>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute right-3 top-3 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="ابحث برقم الأمر، الموضوع، أو اسم الموظف المشمول..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={cn(
                            "w-full pr-9 pl-4 py-2 text-xs rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-purple-500/30",
                            isDark ? "bg-slate-900/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
                        )}
                    />
                </div>
                <div>
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className={cn(
                            "px-3 py-2 text-xs rounded-xl border transition-all focus:outline-none",
                            isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
                        )}
                    >
                        <option value="all">كافة أنواع الأوامر</option>
                        <option value="assignment">تكليف / نقل</option>
                        <option value="committee">تشكيل لجنة</option>
                        <option value="appreciation">شكر وتقدير</option>
                        <option value="penalty">عقوبة انضباطية</option>
                        <option value="promotion">ترفيع وعلاوة</option>
                    </select>
                </div>
            </div>

            {/* List */}
            <div className={cn(
                "rounded-2xl border overflow-hidden",
                isDark ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200 shadow-sm"
            )}>
                {filteredItems.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground text-sm">
                        لا توجد أوامر إدارية مطابقة للبحث
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {filteredItems.map(item => (
                            <div
                                key={item.id}
                                className={cn(
                                    "p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors hover:bg-purple-500/5",
                                    isDark ? "hover:bg-purple-500/10" : ""
                                )}
                            >
                                <div className="space-y-1.5 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-bold text-sm text-purple-600 dark:text-purple-400 font-mono">
                                            {item.orderNumber}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            تاريخ: {item.orderDate}
                                        </span>
                                        {getOrderTypeBadge(item.orderType)}
                                    </div>

                                    <h3 className="font-bold text-sm text-foreground">{item.subject}</h3>

                                    {item.targetEmployees.length > 0 && (
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <Users className="w-3.5 h-3.5 text-purple-500" />
                                            <span>المشمولون:</span>
                                            <span className="font-medium text-foreground">{item.targetEmployees.join(' • ')}</span>
                                        </div>
                                    )}

                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                        {item.orderContent}
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
                                        <FileText className="w-3.5 h-3.5 text-purple-500" />
                                        <span>نص الأمر</span>
                                    </button>
                                    <button
                                        onClick={() => window.print()}
                                        className={cn(
                                            "px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all",
                                            isDark ? "border-slate-700 bg-slate-800 hover:bg-slate-700" : "border-slate-200 bg-slate-100 hover:bg-slate-200"
                                        )}
                                    >
                                        <Printer className="w-3.5 h-3.5 text-emerald-500" />
                                        <span>طباعة</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal: Create Order */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pt-16 sm:pt-20 pb-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className={cn(
                        "w-full max-w-2xl rounded-2xl border shadow-2xl p-6 relative max-h-[calc(100vh-5.5rem)] flex flex-col my-auto overflow-hidden",
                        isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"
                    )}>
                        <div className="flex items-center justify-between pb-4 border-b border-border mb-4 shrink-0">
                            <div className="flex items-center gap-2">
                                <ScrollText className="w-5 h-5 text-purple-500" />
                                <h3 className="font-bold text-base">صياغة أمر إداري جديد</h3>
                            </div>
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreate} className="space-y-4 text-xs overflow-y-auto pr-1 flex-1">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block font-bold mb-1">رقم الأمر الإداري *</label>
                                    <input
                                        type="text"
                                        required
                                        value={orderNumber}
                                        onChange={(e) => setOrderNumber(e.target.value)}
                                        className={cn(
                                            "w-full p-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500/30",
                                            isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                        )}
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold mb-1">تاريخ الإصدار *</label>
                                    <input
                                        type="date"
                                        required
                                        value={orderDate}
                                        onChange={(e) => setOrderDate(e.target.value)}
                                        className={cn(
                                            "w-full p-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500/30",
                                            isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                        )}
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold mb-1">نوع الأمر *</label>
                                    <select
                                        value={orderType}
                                        onChange={(e) => setOrderType(e.target.value as any)}
                                        className={cn(
                                            "w-full p-2.5 rounded-xl border focus:outline-none",
                                            isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                        )}
                                    >
                                        <option value="assignment">تكليف / نقل</option>
                                        <option value="committee">تشكيل لجنة</option>
                                        <option value="appreciation">شكر وتقدير</option>
                                        <option value="penalty">عقوبة انضباطية</option>
                                        <option value="promotion">ترفيع وعلاوة</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold mb-1">موضوع الأمر الإداري *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="مثال: تكليف بمهام الإشراف على صيانة الشبكات الضوئية"
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    className={cn(
                                        "w-full p-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500/30",
                                        isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                    )}
                                />
                            </div>

                            <div>
                                <label className="block font-bold mb-1">الموظفون المشمولون (افصل بينهم بفارزة)</label>
                                <input
                                    type="text"
                                    placeholder="مثال: أسيل جبار عبد السادة، بشير مرتضى مصطفى"
                                    value={targetEmployeesStr}
                                    onChange={(e) => setTargetEmployeesStr(e.target.value)}
                                    className={cn(
                                        "w-full p-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500/30",
                                        isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                    )}
                                />
                            </div>

                            <div>
                                <label className="block font-bold mb-1">المستند القانوني / الديباجة</label>
                                <input
                                    type="text"
                                    value={legalBasis}
                                    onChange={(e) => setLegalBasis(e.target.value)}
                                    className={cn(
                                        "w-full p-2.5 rounded-xl border focus:outline-none",
                                        isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                    )}
                                />
                            </div>

                            <div>
                                <label className="block font-bold mb-1">الموقّع على الأمر الإداري</label>
                                <input
                                    type="text"
                                    value={signatory}
                                    onChange={(e) => setSignatory(e.target.value)}
                                    className={cn(
                                        "w-full p-2.5 rounded-xl border focus:outline-none",
                                        isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                    )}
                                />
                            </div>

                            <div>
                                <label className="block font-bold mb-1">نص الأمر ومواده *</label>
                                <textarea
                                    rows={4}
                                    required
                                    placeholder="اكتب مواد وفقرات الأمر الإداري..."
                                    value={orderContent}
                                    onChange={(e) => setOrderContent(e.target.value)}
                                    className={cn(
                                        "w-full p-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500/30",
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
                                    className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-600/20"
                                >
                                    حفظ واعتماد الأمر
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: View Order Content */}
            {selectedItem && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pt-16 sm:pt-20 pb-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className={cn(
                        "w-full max-w-xl rounded-2xl border shadow-2xl p-6 relative max-h-[calc(100vh-5.5rem)] flex flex-col my-auto overflow-hidden",
                        isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"
                    )}>
                        <div className="flex items-center justify-between pb-3 border-b border-border mb-4 shrink-0">
                            <span className="font-bold text-base text-purple-600 dark:text-purple-400 font-mono">
                                {selectedItem.orderNumber}
                            </span>
                            <button
                                onClick={() => setSelectedItem(null)}
                                className="p-1 rounded-lg hover:bg-secondary"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-3 text-xs overflow-y-auto pr-1 flex-1">
                            <div className="text-center pb-2 border-b border-border">
                                <h3 className="font-bold text-sm">وزارة الاتصالات / الشركة العامة للاتصالات والمعلوماتية</h3>
                                <h4 className="font-bold text-xs text-muted-foreground mt-0.5">مديرية اتصالات ومعلوماتية كربلاء المقدسة</h4>
                                <span className="inline-block mt-2 font-bold px-3 py-1 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                                    أمر إداري رقم ({selectedItem.orderNumber}) في {selectedItem.orderDate}
                                </span>
                            </div>

                            <div>
                                <span className="font-bold text-muted-foreground block text-[11px]">الموضوع:</span>
                                <p className="font-bold text-sm mt-0.5">{selectedItem.subject}</p>
                            </div>

                            {selectedItem.legalBasis && (
                                <p className="text-xs text-muted-foreground italic">
                                    {selectedItem.legalBasis} تقرر ما يلي:
                                </p>
                            )}

                            <div className="p-3 rounded-xl bg-secondary/50 border border-border whitespace-pre-wrap leading-relaxed font-tajawal">
                                {selectedItem.orderContent}
                            </div>

                            {selectedItem.targetEmployees.length > 0 && (
                                <div>
                                    <span className="font-bold text-muted-foreground block text-[11px] mb-1">الأسماء المشمولة:</span>
                                    <ul className="list-disc list-inside space-y-0.5 text-xs text-foreground font-medium">
                                        {selectedItem.targetEmployees.map((emp, i) => (
                                            <li key={i}>{emp}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="text-left pt-3">
                                <p className="font-bold text-xs">{selectedItem.signatory}</p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-4 border-t border-border mt-4 shrink-0">
                            <button
                                onClick={() => window.print()}
                                className="px-4 py-2 rounded-xl bg-purple-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-md"
                            >
                                <Printer className="w-4 h-4" />
                                <span>طباعة الأمر الرسمي</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
