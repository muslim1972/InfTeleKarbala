import { useState, useEffect } from "react";
import { Award, User, Scissors, FileText, Clock, ChevronDown, Save, Plus, Pencil } from "lucide-react";
import { AccordionSection } from "../../ui/AccordionSection";
import { RecordList } from "../../features/RecordList";
import { Input } from "../../ui/Input";
import { Button } from "../../ui/Button";
import { Label } from "../../ui/Label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../../ui/Select";
import { ToggleSwitch } from "../../ui/ToggleSwitch";
import { DateInput } from "../../ui/DateInput";
import { cn } from "../../../lib/utils";

type RecordCategory = 'thanks' | 'committees' | 'penalties';

interface TabAdminRecordsProps {
    selectedEmployee: any;
    yearlyData: any[];
    selectedAdminYear: number;
    setSelectedAdminYear?: (year: number) => void;
    embedded?: boolean;
    adminRecords: {
        thanks: any[];
        committees: any[];
        penalties: any[];
        leaves: any[];
    };
    handleSaveRecord: (type: 'thanks' | 'committees' | 'penalties' | 'leaves', data: any) => Promise<void>;
    handleDeleteRecord: (type: 'thanks' | 'committees' | 'penalties' | 'leaves', id: string) => Promise<void>;
    openRecordSection: string | null;
    handleToggleRecordSection: (section: string) => void;
    isFieldReadOnly: (columnName: string) => boolean;
    activeFiveYearLeave: any;
    setShowFiveYearLeaveModal: (show: boolean) => void;
    setShowFiveYearLeaveHistoryModal: (show: boolean) => void;
    financialData: any;
    handleFiveYearLeaveChange: (checked: boolean) => void;
    newFiveYearLeave: any;
    handleNewFiveYearLeaveChange: (field: string, value: string) => void;
    handleCreateFiveYearLeave: () => Promise<void>;
    loading: boolean;
}

const CATEGORY_CONFIG: Record<RecordCategory, {
    title: string;
    shortLabel: string;
    countLabel: string;
    yearlyField: string;
    icon: any;
    activeClass: string;
    borderClass: string;
    badgeClass: string;
    fields: any[];
}> = {
    thanks: {
        title: "كتب الشكر والتقدير",
        shortLabel: "شكر وتقدير",
        countLabel: "عدد كتب الشكر والتقدير",
        yearlyField: "thanks_books_count",
        icon: Award,
        activeClass: "bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-500/20",
        borderClass: "border-teal-500/30 bg-teal-500/5",
        badgeClass: "bg-teal-600/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
        fields: [
            { key: 'book_number', label: 'رقم الكتاب' },
            { key: 'book_date', label: 'تاريخ الكتاب', type: 'date-split' },
            { key: 'reason', label: 'سبب الشكر' },
            { key: 'issuer', label: 'الجهة المانحة' }
        ]
    },
    committees: {
        title: "اللجان",
        shortLabel: "اللجان",
        countLabel: "عدد اللجان",
        yearlyField: "committees_count",
        icon: User,
        activeClass: "bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/20",
        borderClass: "border-purple-500/30 bg-purple-500/5",
        badgeClass: "bg-purple-600/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
        fields: [
            { key: 'committee_name', label: 'اسم اللجنة' },
            { key: 'role', label: 'العضوية / الصفة' },
            { key: 'start_date', label: 'تاريخ اللجنة', type: 'date-split' }
        ]
    },
    penalties: {
        title: "العقوبات",
        shortLabel: "العقوبات",
        countLabel: "عدد العقوبات",
        yearlyField: "penalties_count",
        icon: Scissors,
        activeClass: "bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-500/20",
        borderClass: "border-rose-500/30 bg-rose-500/5",
        badgeClass: "bg-rose-600/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
        fields: [
            { key: 'penalty_type', label: 'نوع العقوبة' },
            { key: 'reason', label: 'السبب' },
            { key: 'penalty_date', label: 'تاريخ العقوبة', type: 'date-split' },
            { key: 'effect', label: 'الأثر المترتب (اختياري)' }
        ]
    }
};

export const TabAdminRecords = ({
    selectedEmployee,
    yearlyData,
    selectedAdminYear,
    setSelectedAdminYear,
    embedded = false,
    adminRecords,
    handleSaveRecord,
    handleDeleteRecord,
    openRecordSection,
    handleToggleRecordSection,
    isFieldReadOnly,
    activeFiveYearLeave,
    setShowFiveYearLeaveModal,
    setShowFiveYearLeaveHistoryModal,
    financialData,
    handleFiveYearLeaveChange,
    newFiveYearLeave,
    handleNewFiveYearLeaveChange,
    handleCreateFiveYearLeave,
    loading
}: TabAdminRecordsProps) => {
    const currentYear = new Date().getFullYear();
    const [activeCategory, setActiveCategory] = useState<RecordCategory>('thanks');
    const [newItem, setNewItem] = useState<any>({});
    const [isEditing, setIsEditing] = useState(false);

    // حقل السنة المدمج في الشريط السفلي لاستعلام وعرض العدد
    const [yearQueryInput, setYearQueryInput] = useState<string>(String(selectedAdminYear || currentYear));

    useEffect(() => {
        setYearQueryInput(String(selectedAdminYear || currentYear));
    }, [selectedAdminYear, currentYear]);

    if (!selectedEmployee) {
        return (
            <div className="text-center py-20">
                <div className="p-4 bg-white/50 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4 border border-border/50 shadow-sm">
                    <FileText className="w-10 h-10 text-muted-foreground/30" />
                </div>
                <h3 className="text-foreground font-bold text-xl mb-2">سجلات الموظفين</h3>
                <p className="text-muted-foreground">ابدأ بالبحث عن موظف لإدارة سجلاته الإدارية</p>
            </div>
        );
    }

    const activeCfg = CATEGORY_CONFIG[activeCategory];
    const activeData = adminRecords[activeCategory] || [];
    const activeReadOnly = isFieldReadOnly(activeCategory);

    // حساب السنة المختارة في الشريط السفلي وإرجاع العدد الفعلي لها (أو 0)
    const parsedQueryYear = /^\d{4}$/.test(yearQueryInput.trim()) ? parseInt(yearQueryInput.trim(), 10) : null;
    const matchedYearRec = parsedQueryYear !== null
        ? yearlyData.find((yr: any) => Number(yr.year) === parsedQueryYear)
        : undefined;
    const yearlyCountForQuery = parsedQueryYear !== null
        ? Number(matchedYearRec?.[activeCfg.yearlyField] ?? 0)
        : 0;
    const displayedCount = parsedQueryYear !== null && parsedQueryYear === selectedAdminYear
        ? Math.max(yearlyCountForQuery, activeData.length)
        : yearlyCountForQuery;

    const selectableYears = Array.from({ length: currentYear - 1990 + 1 }, (_, i) => currentYear - i);

    const handleCategorySwitch = (cat: RecordCategory) => {
        if (cat === activeCategory) return;
        setActiveCategory(cat);
        setNewItem({});
        setIsEditing(false);
    };

    const handleYearInputChange = (val: string) => {
        const cleaned = val.replace(/\D/g, '').slice(0, 4);
        setYearQueryInput(cleaned);
        if (cleaned.length === 4 && setSelectedAdminYear) {
            const yr = parseInt(cleaned, 10);
            if (yr >= 1980 && yr <= currentYear + 1) {
                setSelectedAdminYear(yr);
            }
        }
    };

    const handleSaveUnified = () => {
        handleSaveRecord(activeCategory, { ...newItem });
        setNewItem({});
        setIsEditing(false);
    };

    return (
        <div className={cn(
            "space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500",
            !embedded && "space-y-6 mx-6 pb-2"
        )}>
            {/* 1. الأزرار الثلاثة الأفقية بارتفاع بسيط بدلاً من شريط السنوات */}
            <div className="grid grid-cols-3 gap-1.5">
                {(['thanks', 'committees', 'penalties'] as RecordCategory[]).map((cat) => {
                    const cfg = CATEGORY_CONFIG[cat];
                    const Icon = cfg.icon;
                    const isActive = activeCategory === cat;
                    return (
                        <button
                            key={cat}
                            type="button"
                            onClick={() => handleCategorySwitch(cat)}
                            className={cn(
                                "flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl border text-[11px] sm:text-xs font-bold transition-all duration-200 active:scale-95",
                                isActive
                                    ? cfg.activeClass
                                    : "bg-white dark:bg-slate-900/70 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5"
                            )}
                        >
                            <Icon className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{cfg.shortLabel}</span>
                        </button>
                    );
                })}
            </div>

            {/* 2. الجسم الموحد للتبويبة الفرعية المختارة (شكر / لجان / عقوبات) */}
            <div className={cn("p-3.5 rounded-xl border space-y-4 transition-colors", activeCfg.borderClass)}>
                {!activeReadOnly && (
                    <div className={cn(
                        "p-3.5 rounded-xl border space-y-3 transition-colors",
                        isEditing ? "bg-brand-green/10 border-brand-green/30" : "bg-white/80 dark:bg-slate-900/60 border-border"
                    )}>
                        <h4 className={cn("text-xs sm:text-sm font-bold flex items-center gap-2", isEditing ? "text-brand-green" : "text-foreground/80")}>
                            {isEditing ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                            {isEditing ? `تعديل (${activeCfg.shortLabel})` : "إضافة سجل جديد"}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {activeCfg.fields.map((field: any) => (
                                <div key={field.key} className="grid grid-cols-[110px_1fr] sm:grid-cols-[132px_1fr] items-center gap-2">
                                    <div className="flex justify-start pl-1">
                                        <label className="text-xs text-muted-foreground font-bold block whitespace-nowrap text-right w-full">{field.label}</label>
                                    </div>
                                    <div className="flex-1 relative">
                                        {field.type === 'date-split' ? (() => {
                                            const defaultYear = parsedQueryYear || selectedAdminYear || currentYear;
                                            const currentVal = newItem[field.key] || `${defaultYear}-01-01`;
                                            const parts = currentVal.split('-');
                                            const yrVal = parts[0] || String(defaultYear);
                                            const monVal = parts[1] || '';
                                            const dayVal = parts[2] || '';
                                            return (
                                                <div className="flex gap-1.5">
                                                    <Input
                                                        type="text"
                                                        inputMode="numeric"
                                                        maxLength={2}
                                                        placeholder="يوم"
                                                        value={newItem[field.key] ? dayVal : ''}
                                                        onChange={e => {
                                                            let day = e.target.value.replace(/\D/g, '');
                                                            if (parseInt(day, 10) > 31) day = "31";
                                                            const dayStr = day.length === 1 ? `0${day}` : day;
                                                            setNewItem({ ...newItem, [field.key]: `${yrVal}-${monVal || '01'}-${dayStr || '01'}` });
                                                        }}
                                                        className="flex-1 min-w-0 text-center px-1.5"
                                                    />
                                                    <div className="flex-1 min-w-0 relative">
                                                        <Select
                                                            value={newItem[field.key] ? monVal : ''}
                                                            onValueChange={(val) => {
                                                                setNewItem({ ...newItem, [field.key]: `${yrVal}-${val}-${dayVal || '01'}` });
                                                            }}
                                                        >
                                                            <SelectTrigger className="w-full px-2">
                                                                <SelectValue placeholder="شهر" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                                                    <SelectItem key={m} value={m.toString().padStart(2, '0')}>{m}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="w-[74px] shrink-0 relative">
                                                        <Select
                                                            value={yrVal}
                                                            onValueChange={(val) => {
                                                                setNewItem({ ...newItem, [field.key]: `${val}-${monVal || '01'}-${dayVal || '01'}` });
                                                            }}
                                                        >
                                                            <SelectTrigger className="w-full px-2 font-mono text-xs">
                                                                <SelectValue placeholder="السنة" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {selectableYears.map(y => (
                                                                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            );
                                        })() : (
                                            <Input
                                                type={field.type || "text"}
                                                placeholder={field.label}
                                                value={newItem[field.key] || ""}
                                                onChange={e => setNewItem({ ...newItem, [field.key]: e.target.value })}
                                                className="flex-1"
                                            />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={handleSaveUnified}
                                className={cn(
                                    "flex-1 py-2 rounded-lg text-sm font-bold transition-colors",
                                    isEditing ? "bg-brand-green text-white hover:bg-brand-green/90" : "bg-brand-green/20 text-brand-green hover:bg-brand-green/30"
                                )}
                            >
                                {isEditing ? "حفظ التعديلات" : "حفظ السجل"}
                            </button>
                            {isEditing && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsEditing(false);
                                        setNewItem({});
                                    }}
                                    className="px-4 py-2 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-800 dark:text-white rounded-lg text-sm font-bold"
                                >
                                    إلغاء
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* قائمة السجلات التفصيلية للسنة المختارة إن وجدت */}
                <RecordList
                    data={activeData}
                    fields={activeCfg.fields}
                    type={activeCategory}
                    onEdit={activeReadOnly ? undefined : (item) => {
                        setNewItem(item);
                        setIsEditing(true);
                    }}
                    onDelete={activeReadOnly ? undefined : (t, id) => handleDeleteRecord(t as any, id)}
                    hideEmpty={displayedCount > 0}
                />
            </div>

            {/* 3. الشريط البسيط أسفل المستطيل: حقل السنة + تسمية العدد + العدد لتلك السنة (0 إن لم يوجد) */}
            <div className="flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-white/10 shadow-sm">
                <div className="relative flex items-center shrink-0 w-28">
                    <Input
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        value={yearQueryInput}
                        onChange={(e) => handleYearInputChange(e.target.value)}
                        placeholder="السنة"
                        aria-label="إدخال السنة"
                        className="w-full h-8 text-center font-mono font-bold text-xs sm:text-sm pr-2 pl-7 bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-white/15"
                    />
                    <div className="absolute left-1 top-1/2 -translate-y-1/2 w-5 h-6 flex items-center justify-center">
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                        <select
                            aria-label="اختر السنة"
                            value={parsedQueryYear && selectableYears.includes(parsedQueryYear) ? String(parsedQueryYear) : ''}
                            onChange={(e) => handleYearInputChange(e.target.value)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        >
                            {selectableYears.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 truncate">
                        {activeCfg.countLabel}
                    </span>
                    <span className={cn(
                        "min-w-[34px] h-7 px-2.5 rounded-lg border font-mono font-black text-sm flex items-center justify-center shrink-0 transition-colors",
                        activeCfg.badgeClass
                    )}>
                        {displayedCount}
                    </span>
                </div>
            </div>

            {/* 4. القسمين الآخرين: الإجازات وإجازة الخمس سنوات */}
            <div className="space-y-4 pt-1">
                <RecordSection
                    id="leaves"
                    title="الاجازات"
                    icon={FileText}
                    color="from-green-600 to-green-500"
                    data={adminRecords.leaves}
                    type="leaves"
                    onSave={handleSaveRecord}
                    onDelete={handleDeleteRecord}
                    isOpen={openRecordSection === 'leaves'}
                    onToggle={() => handleToggleRecordSection('leaves')}
                    selectedYear={selectedAdminYear}
                    readOnly={isFieldReadOnly('leaves')}
                    fields={[
                        {
                            key: 'leave_type',
                            label: 'نوع الاجازة',
                            type: 'select',
                            options: ['اعتيادية', 'مرضية', 'سنوات', 'لجان طبية', 'ايقاف عن العمل']
                        },
                        { key: 'duration', label: 'المدة (محسوبة)', readOnly: true },
                        { key: 'start_date', label: 'تاريخ الانفكاك', type: 'date-fixed-year' },
                        { key: 'end_date', label: 'تاريخ المباشرة (اختياري)', type: 'date-fixed-year' },
                    ]}
                />

                {/* Five Year Leave Section */}
                <AccordionSection
                    id="five_year_leave"
                    title="إجازة الخمس سنوات"
                    icon={Clock}
                    isOpen={openRecordSection === 'five_year_leave'}
                    color="from-orange-600 to-orange-500"
                    onToggle={() => handleToggleRecordSection('five_year_leave')}
                >
                    <div className="p-4 grid grid-cols-1 gap-4">
                        {activeFiveYearLeave ? (
                            <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-xl flex items-center justify-between cursor-pointer hover:bg-orange-500/20 transition-colors"
                                onClick={() => setShowFiveYearLeaveModal(true)}>
                                <div>
                                    <h4 className="font-bold text-orange-600 dark:text-orange-400 flex items-center gap-2">ملخص إجازة الخمس سنوات
                                        {activeFiveYearLeave.status === 'canceled' && <span className="text-red-500 text-xs border border-red-500/50 px-2 py-0.5 rounded-full">ملغاة</span>}
                                    </h4>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        رقم الأمر: {activeFiveYearLeave.order_number} | تاريخ الانفكاك: {activeFiveYearLeave.start_date}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowFiveYearLeaveHistoryModal(true);
                                        }}
                                        className="p-2 hover:bg-orange-600/10 dark:hover:bg-orange-400/10 rounded-full transition-colors text-orange-600 dark:text-orange-400"
                                        title="سجل الحركات"
                                    >
                                        <Clock className="w-5 h-5" />
                                    </button>
                                    <ChevronDown className="w-5 h-5 text-orange-500 -rotate-90" />
                                </div>
                            </div>
                        ) : (
                            <>
                                <div id="record-section-five_year_leave" className="flex items-center gap-4 bg-muted/50 dark:bg-white/5 p-4 rounded-xl border border-border dark:border-white/10">
                                    <ToggleSwitch
                                        checked={financialData?.is_five_year_leave || false}
                                        onCheckedChange={handleFiveYearLeaveChange}
                                    />
                                    <div>
                                        <p className="font-bold text-foreground dark:text-white">تفعيل إجازة الخمس سنوات</p>
                                        <p className="text-xs text-muted-foreground dark:text-white/50">عند التفعيل، سيتم تصفير المخصصات وتفعيل الاستقطاعات تلقائياً.</p>
                                    </div>
                                </div>

                                {(financialData?.is_five_year_leave) && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 mt-4 bg-muted/30 dark:bg-white/5 p-4 rounded-lg border border-border dark:border-white/10">
                                        <div className="space-y-2">
                                            <Label className="text-foreground dark:text-white">رقم الأمر</Label>
                                            <Input
                                                type="text"
                                                value={newFiveYearLeave.order_number}
                                                onChange={(e) => handleNewFiveYearLeaveChange('order_number', e.target.value)}
                                                className="bg-transparent dark:bg-zinc-900/50 border-input dark:border-white/10 text-foreground dark:text-white"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-foreground dark:text-white">تاريخ الأمر</Label>
                                            <DateInput
                                                value={newFiveYearLeave.order_date}
                                                onChange={(val) => handleNewFiveYearLeaveChange('order_date', val)}
                                                className="bg-transparent dark:bg-zinc-900/50 border-input dark:border-white/10 text-foreground dark:text-white"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-foreground dark:text-white">تاريخ الانفكاك</Label>
                                            <DateInput
                                                value={newFiveYearLeave.start_date}
                                                onChange={(val) => handleNewFiveYearLeaveChange('start_date', val)}
                                                className="bg-transparent dark:bg-zinc-900/50 border-input dark:border-white/10 text-foreground dark:text-white"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-foreground dark:text-white">تاريخ المباشرة المتوقع (+5 سنوات)</Label>
                                            <Input
                                                type="text"
                                                value={newFiveYearLeave.end_date ? newFiveYearLeave.end_date.split('-').reverse().join('/') : ""}
                                                readOnly
                                                className="bg-muted dark:bg-zinc-900/50 border-border dark:border-white/5 text-muted-foreground cursor-not-allowed font-mono text-left dir-ltr"
                                            />
                                        </div>
                                    </div>
                                )}

                                {(financialData?.is_five_year_leave) && (
                                    <div className="flex justify-end mt-4 pt-4 border-t border-white/10">
                                        <Button
                                            disabled={!newFiveYearLeave.order_number || !newFiveYearLeave.order_date || !newFiveYearLeave.start_date || loading}
                                            onClick={handleCreateFiveYearLeave}
                                            className="bg-orange-600 hover:bg-orange-500 text-white gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Save className="w-4 h-4" />
                                            حفظ الأجازة وتفعيلها
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </AccordionSection>
            </div>
        </div>
    );
};

function RecordSection({ id, title, icon: Icon, color, data, onSave, onDelete, type, fields, isOpen, onToggle, selectedYear, yearlyCount, readOnly = false }: any) {
    const [newItem, setNewItem] = useState<any>({});
    const [isEditing, setIsEditing] = useState(false);

    const calculateDuration = () => {
        if (newItem.start_date && newItem.end_date) {
            const start = new Date(newItem.start_date);
            const end = new Date(newItem.end_date);
            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                const diffTime = Math.abs(end.getTime() - start.getTime());
                return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            }
        }
        return 0;
    };

    const handleSave = () => {
        const finalItem = { ...newItem };

        if (type === 'leaves') {
            const now = new Date();
            const startStr = finalItem.start_date;
            const endStr = finalItem.end_date;

            if (!startStr) {
                alert("يرجى تحديد تاريخ الانفكاك");
                return;
            }

            const start = new Date(startStr);
            const end = endStr ? new Date(endStr) : null;

            if (start > now) {
                alert("خطأ: لا يمكن اختيار تاريخ انفكاك في المستقبل!");
                return;
            }
            if (end && end > now) {
                alert("خطأ: لا يمكن اختيار تاريخ مباشرة في المستقبل!");
                return;
            }

            if (end && start > end) {
                alert("خطأ: تاريخ الانفكاك يجب أن يكون قبل تاريخ المباشرة!");
                return;
            }

            if (startStr && endStr) {
                finalItem.duration = calculateDuration();
            } else {
                finalItem.duration = 0;
            }
        }

        onSave(type, finalItem);
        setNewItem({});
        setIsEditing(false);
    };

    return (
        <AccordionSection
            id={`record-section-${id}`}
            title={`${title} (${yearlyCount !== undefined && yearlyCount !== null ? yearlyCount : data.length})`}
            icon={Icon}
            isOpen={isOpen}
            onToggle={onToggle}
            color={color}
        >
            <div className="space-y-4">
                {!readOnly && (
                    <div className={cn("p-4 rounded-xl border space-y-3 transition-colors", isEditing ? "bg-brand-green/10 border-brand-green/30" : "bg-muted/50 border-border")}>
                        <h4 className={cn("text-sm font-bold flex items-center gap-2", isEditing ? "text-brand-green" : "text-foreground/70")}>
                            {isEditing ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                            {isEditing ? "تعديل السجل" : "إضافة سجل جديد"}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {fields.map((field: any) => (
                                <div key={field.key} className="grid grid-cols-[132px_1fr] items-center gap-2">
                                    <div className="flex justify-start pl-2">
                                        <label className="text-xs text-muted-foreground font-bold block whitespace-nowrap text-right w-full">{field.label}</label>
                                    </div>
                                    <div className="flex items-center gap-2 relative w-full">
                                        <div className="w-6 shrink-0" />
                                        <div className="flex-1 relative">
                                            {field.type === 'select' ? (
                                                <div className="relative">
                                                    <Select
                                                        value={newItem[field.key] || ""}
                                                        onValueChange={(val) => setNewItem({ ...newItem, [field.key]: val })}
                                                    >
                                                        <SelectTrigger className="w-full">
                                                            <SelectValue placeholder="اختر..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="default_placeholder" className="hidden">اختر...</SelectItem>
                                                            {field.options?.map((opt: string) => (
                                                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            ) : field.type === 'date-fixed-year' ? (
                                                <div className="flex gap-2">
                                                    <Input
                                                        type="text"
                                                        inputMode="numeric"
                                                        maxLength={2}
                                                        placeholder="يوم"
                                                        value={newItem[field.key] ? newItem[field.key].split('-')[2] : ''}
                                                        onChange={e => {
                                                            let day = e.target.value.replace(/\D/g, '');
                                                            if (parseInt(day) > 31) day = "31";
                                                            const dayStr = day.length === 1 ? `0${day}` : day;
                                                            const current = newItem[field.key] || `${selectedYear}-01-01`;
                                                            const parts = current.split('-');
                                                            setNewItem({ ...newItem, [field.key]: `${selectedYear || parts[0]}-${parts[1]}-${dayStr}` });
                                                        }}
                                                        className="flex-1 text-center"
                                                    />
                                                    <div className="flex-1 relative">
                                                        <Select
                                                            value={newItem[field.key] ? newItem[field.key].split('-')[1] : ''}
                                                            onValueChange={(val) => {
                                                                const month = val;
                                                                const current = newItem[field.key] || `${selectedYear}-01-01`;
                                                                const parts = current.split('-');
                                                                setNewItem({ ...newItem, [field.key]: `${selectedYear || parts[0]}-${month}-${parts[2]}` });
                                                            }}
                                                        >
                                                            <SelectTrigger className="w-full">
                                                                <SelectValue placeholder="شهر" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                                                    <SelectItem key={m} value={m.toString().padStart(2, '0')}>{m}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="flex-1 bg-muted border border-border rounded-lg px-2 py-2 text-muted-foreground text-sm text-center font-mono select-none flex items-center justify-center">
                                                        {selectedYear}
                                                    </div>
                                                </div>
                                            ) : field.readOnly ? (
                                                <Input
                                                    type="text"
                                                    value={field.key === 'duration' ? calculateDuration() : (newItem[field.key] || "")}
                                                    readOnly
                                                    className="w-full bg-muted border border-border text-muted-foreground cursor-not-allowed font-bold"
                                                />
                                            ) : (
                                                <Input
                                                    type={field.type || "text"}
                                                    placeholder={field.label}
                                                    value={newItem[field.key] || ""}
                                                    onChange={e => setNewItem({ ...newItem, [field.key]: e.target.value })}
                                                    className="flex-1"
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleSave}
                                className={cn("flex-1 py-2 rounded-lg text-sm font-bold transition-colors",
                                    isEditing ? "bg-brand-green text-white hover:bg-brand-green/90" : "bg-brand-green/20 text-brand-green hover:bg-brand-green/30"
                                )}
                            >
                                {isEditing ? "حفظ التعديلات" : "حفظ السجل"}
                            </button>
                            {isEditing && (
                                <button
                                    onClick={() => {
                                        setIsEditing(false);
                                        setNewItem({});
                                    }}
                                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-bold"
                                >
                                    إلغاء
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {yearlyCount > 0 && data.length === 0 && (
                    <div className="flex items-center justify-between p-4 rounded-xl border border-brand-green/20 bg-brand-green/5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-brand-green/20 flex items-center justify-center">
                                <span className="text-brand-green font-bold text-lg">{yearlyCount}</span>
                            </div>
                            <div>
                                <p className="text-sm font-bold text-foreground">{title} مسجلة لسنة {selectedYear}</p>
                                <p className="text-xs text-muted-foreground">البيانات المستوردة من كشف الراتب</p>
                            </div>
                        </div>
                    </div>
                )}

                <RecordList
                    data={data}
                    fields={fields}
                    type={type}
                    onEdit={readOnly ? undefined : (item) => {
                        setNewItem(item);
                        setIsEditing(true);
                    }}
                    onDelete={readOnly ? undefined : onDelete}
                    hideEmpty={yearlyCount > 0}
                />
            </div>
        </AccordionSection >
    );
}
