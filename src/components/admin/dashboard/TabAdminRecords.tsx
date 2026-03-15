import { useState } from "react";
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

interface TabAdminRecordsProps {
    selectedEmployee: any;
    yearlyData: any[];
    selectedAdminYear: number;
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

export const TabAdminRecords = ({
    selectedEmployee,
    yearlyData,
    selectedAdminYear,
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

    const yearRec = yearlyData.find((yr: any) => yr.year === selectedAdminYear);
    const isCurrentYear = selectedAdminYear === new Date().getFullYear();

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 mx-6">
            {/* Sections */}
            <div className="space-y-4">
                <RecordSection
                    id="thanks"
                    title="كتب الشكر والتقدير"
                    icon={Award}
                    color="from-teal-600 to-teal-500"
                    data={adminRecords.thanks}
                    type="thanks"
                    onSave={handleSaveRecord}
                    onDelete={handleDeleteRecord}
                    isOpen={openRecordSection === 'thanks'}
                    onToggle={() => handleToggleRecordSection('thanks')}
                    selectedYear={selectedAdminYear}
                    yearlyCount={yearRec?.thanks_books_count}
                    readOnly={!isCurrentYear || isFieldReadOnly('thanks')}
                    fields={[
                        { key: 'book_number', label: 'رقم الكتاب' },
                        { key: 'book_date', label: 'تاريخ الكتاب', type: 'date-fixed-year' },
                        { key: 'reason', label: 'سبب الشكر' },
                        { key: 'issuer', label: 'الجهة المانحة' }
                    ]}
                />
                <RecordSection
                    id="committees"
                    title="اللجان"
                    icon={User}
                    color="from-purple-600 to-purple-500"
                    data={adminRecords.committees}
                    type="committees"
                    onSave={handleSaveRecord}
                    onDelete={handleDeleteRecord}
                    isOpen={openRecordSection === 'committees'}
                    onToggle={() => handleToggleRecordSection('committees')}
                    selectedYear={selectedAdminYear}
                    yearlyCount={yearRec?.committees_count}
                    readOnly={!isCurrentYear || isFieldReadOnly('committees')}
                    fields={[
                        { key: 'committee_name', label: 'اسم اللجنة' },
                        { key: 'role', label: 'العضوية / الصفة' },
                        { key: 'start_date', label: 'تاريخ اللجنة', type: 'date-fixed-year' }
                    ]}
                />
                <RecordSection
                    id="penalties"
                    title="العقوبات"
                    icon={Scissors}
                    color="from-red-600 to-red-500"
                    data={adminRecords.penalties}
                    type="penalties"
                    onSave={handleSaveRecord}
                    onDelete={handleDeleteRecord}
                    isOpen={openRecordSection === 'penalties'}
                    onToggle={() => handleToggleRecordSection('penalties')}
                    selectedYear={selectedAdminYear}
                    readOnly={!isCurrentYear || isFieldReadOnly('penalties')}
                    fields={[
                        { key: 'penalty_type', label: 'نوع العقوبة' },
                        { key: 'reason', label: 'السبب' },
                        { key: 'penalty_date', label: 'تاريخ العقوبة', type: 'date-fixed-year' },
                        { key: 'effect', label: 'الأثر المترتب (اختياري)' }
                    ]}
                />
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
                    readOnly={!isCurrentYear}
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
            <div className="pb-32"></div>
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
        let finalItem = { ...newItem };

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
