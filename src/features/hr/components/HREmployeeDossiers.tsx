import { useState } from 'react';
import { FolderArchive, Search, Upload, FileText, Eye, X } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { cn } from '../../../lib/utils';
import type { DossierDocument } from '../types';

interface MockEmployee {
    id: string;
    fullName: string;
    jobNumber: string;
    jobTitle: string;
    department: string;
    hireDate: string;
    leaveBalance: number;
}

const SAMPLE_EMPLOYEES: MockEmployee[] = [
    {
        id: 'emp-1',
        fullName: 'أسيل جبار عبد السادة',
        jobNumber: '8401',
        jobTitle: 'مسؤول شعبة الذاتية والموارد البشرية',
        department: 'قسم الشؤون الإدارية والمالية',
        hireDate: '2012-04-15',
        leaveBalance: 78
    },
    {
        id: 'emp-2',
        fullName: 'بشير مرتضى مصطفى',
        jobNumber: '9102',
        jobTitle: 'مهندس اتصالات أقدم',
        department: 'قسم تجهيز خدمات المعلوماتية',
        hireDate: '2015-08-01',
        leaveBalance: 64
    },
    {
        id: 'emp-3',
        fullName: 'كرار حيدر جاسم',
        jobNumber: '9520',
        jobTitle: 'معاون مهندس شبكات',
        department: 'شعبة التراسل والاتصالات الضوئية',
        hireDate: '2019-11-10',
        leaveBalance: 42
    }
];

const INITIAL_DOCS: DossierDocument[] = [
    {
        id: 'doc-1',
        employeeId: 'emp-1',
        category: 'personal_ids',
        title: 'البطاقة الوطنية الموحدة وبطاقة السكن',
        documentNumber: '1987542109',
        documentDate: '2023-01-10',
        notes: 'مستمسكات رسمية محدثة ومصدقة',
        uploadedAt: '2023-01-15'
    },
    {
        id: 'doc-2',
        employeeId: 'emp-1',
        category: 'appointment',
        title: 'أمر التعيين الوزاري والمباشرة الأولى',
        documentNumber: 'وزاري/4512',
        documentDate: '2012-04-15',
        notes: 'تثبيت على الملاك الدائم',
        uploadedAt: '2012-04-20'
    },
    {
        id: 'doc-3',
        employeeId: 'emp-1',
        category: 'promotions',
        title: 'أمر الترفيع للدرجة الرابعة',
        documentNumber: 'إداري/2024/88',
        documentDate: '2024-03-01',
        notes: 'استحقاق قانوني لاجتياز الدورة بنجاح',
        uploadedAt: '2024-03-05'
    },
    {
        id: 'doc-4',
        employeeId: 'emp-1',
        category: 'penalties_thanks',
        title: 'كتاب شكر وتقدير من السيد المدير العام',
        documentNumber: 'ش/2025/11',
        documentDate: '2025-06-14',
        notes: 'تثميناً للجهود المتميزة في حوسبة السجلات',
        uploadedAt: '2025-06-15'
    }
];

export const HREmployeeDossiers = () => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedEmployee, setSelectedEmployee] = useState<MockEmployee>(SAMPLE_EMPLOYEES[0]);
    const [activeCategory, setActiveCategory] = useState<DossierDocument['category'] | 'all'>('all');
    const [docs, setDocs] = useState<DossierDocument[]>(INITIAL_DOCS);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

    // Upload form
    const [docTitle, setDocTitle] = useState('');
    const [docCategory, setDocCategory] = useState<DossierDocument['category']>('personal_ids');
    const [docNumber, setDocNumber] = useState('');
    const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0]);
    const [docNotes, setDocNotes] = useState('');

    const handleUpload = (e: React.FormEvent) => {
        e.preventDefault();
        if (!docTitle) return;

        const newDoc: DossierDocument = {
            id: `doc-${Date.now()}`,
            employeeId: selectedEmployee.id,
            category: docCategory,
            title: docTitle,
            documentNumber: docNumber,
            documentDate: docDate,
            notes: docNotes,
            uploadedAt: new Date().toISOString().split('T')[0]
        };

        setDocs([newDoc, ...docs]);
        setIsUploadModalOpen(false);
        setDocTitle('');
        setDocNumber('');
        setDocNotes('');
    };

    const employeeDocs = docs.filter(d => d.employeeId === selectedEmployee.id);
    const filteredDocs = activeCategory === 'all'
        ? employeeDocs
        : employeeDocs.filter(d => d.category === activeCategory);

    const categoriesList: { id: DossierDocument['category'] | 'all'; label: string; count: number }[] = [
        { id: 'all', label: 'كافة الوثائق والمستندات', count: employeeDocs.length },
        { id: 'personal_ids', label: 'المستمسكات والوثائق الشخصية', count: employeeDocs.filter(d => d.category === 'personal_ids').length },
        { id: 'appointment', label: 'أوامر التعيين والمباشرة', count: employeeDocs.filter(d => d.category === 'appointment').length },
        { id: 'promotions', label: 'العلاوات والترفيعات', count: employeeDocs.filter(d => d.category === 'promotions').length },
        { id: 'penalties_thanks', label: 'الشكر والتقدير والعقوبات', count: employeeDocs.filter(d => d.category === 'penalties_thanks').length },
        { id: 'leaves', label: 'سجلات الإجازات المعتمدة', count: employeeDocs.filter(d => d.category === 'leaves').length }
    ];

    return (
        <div className="space-y-5 animate-in fade-in duration-300">
            {/* Header / Summary Card */}
            <div className={cn(
                "p-5 rounded-2xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4",
                isDark ? "bg-slate-900/60 border-slate-800 backdrop-blur-md" : "bg-white border-slate-200 shadow-sm"
            )}>
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                        <FolderArchive className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold">الإضبارات الإلكترونية وأرشيف الموظفين</h2>
                        <p className="text-xs text-muted-foreground">الملف الرقمي الموحد لكل موظف، حفظ الوثائق الثبوتية، الأوامر الوزارية والإدارية</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                        onClick={() => setIsUploadModalOpen(true)}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all active:scale-95"
                    >
                        <Upload className="w-4 h-4" />
                        <span>إضافة وثيقة للإضبارة</span>
                    </button>
                </div>
            </div>

            {/* Employee Selector & Quick Search */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute right-3 top-3 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="ابحث عن موظف بالاسم أو الرقم الوظيفي لفتح إضبارته..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={cn(
                            "w-full pr-9 pl-4 py-2 text-xs rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/30",
                            isDark ? "bg-slate-900/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
                        )}
                    />
                </div>
                {/* Quick switcher buttons */}
                <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
                    {SAMPLE_EMPLOYEES.map(emp => (
                        <button
                            key={emp.id}
                            onClick={() => setSelectedEmployee(emp)}
                            className={cn(
                                "px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition-all",
                                selectedEmployee.id === emp.id
                                    ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                                    : "hover:bg-secondary border-border"
                            )}
                        >
                            {emp.fullName} ({emp.jobNumber})
                        </button>
                    ))}
                </div>
            </div>

            {/* Active Employee Profile Card */}
            <div className={cn(
                "p-5 rounded-2xl border relative overflow-hidden",
                isDark ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200 shadow-sm"
            )}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-xl">
                            {selectedEmployee.fullName.slice(0, 1)}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-base text-foreground">{selectedEmployee.fullName}</h3>
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-secondary text-muted-foreground">
                                    الرقم الوظيفي: {selectedEmployee.jobNumber}
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {selectedEmployee.jobTitle} • {selectedEmployee.department}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                تاريخ المباشرة: {selectedEmployee.hireDate} • رصيد الإجازات الحالي: <span className="font-bold text-emerald-600">{selectedEmployee.leaveBalance} يوماً</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Dossier Folders / Category Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1 border-b border-border">
                {categoriesList.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setActiveCategory(cat.id)}
                        className={cn(
                            "px-3 py-2 rounded-t-xl text-xs font-bold whitespace-nowrap transition-all border-b-2 flex items-center gap-1.5",
                            activeCategory === cat.id
                                ? "border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <span>{cat.label}</span>
                        <span className={cn(
                            "px-1.5 py-0.2 rounded-full text-[10px]",
                            activeCategory === cat.id ? "bg-emerald-600 text-white" : "bg-secondary text-muted-foreground"
                        )}>
                            {cat.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Documents Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredDocs.length === 0 ? (
                    <div className="col-span-full p-12 text-center text-muted-foreground text-sm">
                        لا توجد وثائق مؤرشفة في هذا القسم لهذه الإضبارة حتى الآن
                    </div>
                ) : (
                    filteredDocs.map(doc => (
                        <div
                            key={doc.id}
                            className={cn(
                                "p-4 rounded-xl border flex items-start justify-between gap-3 transition-all hover:border-emerald-500/40",
                                isDark ? "bg-slate-900/30 border-slate-800" : "bg-white border-slate-200"
                            )}
                        >
                            <div className="flex items-start gap-3">
                                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mt-0.5">
                                    <FileText className="w-5 h-5" />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="font-bold text-xs text-foreground">{doc.title}</h4>
                                    {doc.documentNumber && (
                                        <p className="text-[11px] text-muted-foreground font-mono">
                                            رقم الوثيقة: {doc.documentNumber} ({doc.documentDate})
                                        </p>
                                    )}
                                    {doc.notes && (
                                        <p className="text-[11px] text-muted-foreground/80 italic">
                                            {doc.notes}
                                        </p>
                                    )}
                                    <span className="text-[10px] text-muted-foreground block">
                                        تاريخ الإيداع بالأرشيف: {doc.uploadedAt}
                                    </span>
                                </div>
                            </div>

                            <button
                                onClick={() => alert("معاينة الوثيقة الممسوحة ضوئياً...")}
                                className={cn(
                                    "p-2 rounded-lg border text-xs hover:bg-secondary transition-all",
                                    isDark ? "border-slate-800" : "border-slate-200"
                                )}
                                title="عرض المستند"
                            >
                                <Eye className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* Upload Modal */}
            {isUploadModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className={cn(
                        "w-full max-w-lg rounded-2xl border shadow-2xl p-6 relative",
                        isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"
                    )}>
                        <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
                            <div className="flex items-center gap-2">
                                <Upload className="w-5 h-5 text-emerald-500" />
                                <h3 className="font-bold text-base">إضافة مستند إلى إضبارة {selectedEmployee.fullName}</h3>
                            </div>
                            <button
                                onClick={() => setIsUploadModalOpen(false)}
                                className="p-1 rounded-lg hover:bg-secondary"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleUpload} className="space-y-4 text-xs">
                            <div>
                                <label className="block font-bold mb-1">عنوان الوثيقة *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="مثال: الأمر الإداري بالترفيع، شهادة التخرج، وثيقة الزواج"
                                    value={docTitle}
                                    onChange={(e) => setDocTitle(e.target.value)}
                                    className={cn(
                                        "w-full p-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500/30",
                                        isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                    )}
                                />
                            </div>

                            <div>
                                <label className="block font-bold mb-1">قسم الإضبارة *</label>
                                <select
                                    value={docCategory}
                                    onChange={(e) => setDocCategory(e.target.value as any)}
                                    className={cn(
                                        "w-full p-2.5 rounded-xl border focus:outline-none",
                                        isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                    )}
                                >
                                    <option value="personal_ids">المستمسكات والوثائق الشخصية</option>
                                    <option value="appointment">أوامر التعيين والمباشرة</option>
                                    <option value="promotions">العلاوات والترفيعات</option>
                                    <option value="penalties_thanks">الشكر والتقدير والعقوبات</option>
                                    <option value="leaves">سجلات الإجازات المعتمدة</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold mb-1">رقم الوثيقة / الكتاب</label>
                                    <input
                                        type="text"
                                        placeholder="رقم الأمر"
                                        value={docNumber}
                                        onChange={(e) => setDocNumber(e.target.value)}
                                        className={cn(
                                            "w-full p-2.5 rounded-xl border focus:outline-none",
                                            isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                        )}
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold mb-1">تاريخ الوثيقة</label>
                                    <input
                                        type="date"
                                        value={docDate}
                                        onChange={(e) => setDocDate(e.target.value)}
                                        className={cn(
                                            "w-full p-2.5 rounded-xl border focus:outline-none",
                                            isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                        )}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold mb-1">رفع الملف الرقمي (PDF أو صورة)</label>
                                <div className="border-2 border-dashed border-border rounded-xl p-4 text-center hover:border-emerald-500/50 transition-colors cursor-pointer">
                                    <Upload className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
                                    <span className="text-[11px] text-muted-foreground block">انقر لاختيار ملف من جهازك أو اسحبه هنا</span>
                                    <span className="text-[9px] text-muted-foreground block mt-0.5">يدعم PDF, JPG, PNG بحجم أقصى 10MB</span>
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold mb-1">ملاحظات إضافية</label>
                                <textarea
                                    rows={2}
                                    placeholder="أي تفاصيل تخص المستند..."
                                    value={docNotes}
                                    onChange={(e) => setDocNotes(e.target.value)}
                                    className={cn(
                                        "w-full p-2 rounded-xl border focus:outline-none",
                                        isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                    )}
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t border-border">
                                <button
                                    type="button"
                                    onClick={() => setIsUploadModalOpen(false)}
                                    className="px-4 py-2 rounded-xl border hover:bg-secondary font-bold text-xs"
                                >
                                    إلغاء
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20"
                                >
                                    حفظ في الإضبارة
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
