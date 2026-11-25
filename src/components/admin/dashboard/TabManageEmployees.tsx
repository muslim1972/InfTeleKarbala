import React from "react";
import { 
    User, 
    CheckCircle, 
    AlertCircle, 
    FileSpreadsheet, 
    DatabaseZap, 
    Shield, 
    ClipboardCheck, 
    ShieldAlert, 
    Scissors, 
    Wallet, 
    Loader2,
    History
} from "lucide-react";
import { TabAdminRecords } from "./TabAdminRecords";
import { HistoryViewer } from "../HistoryViewer";
import { DepartmentSelector } from "../DepartmentSelector";
import { Input } from "../../ui/Input";
import { DateInput } from "../../ui/DateInput";
import { Button } from "../../ui/Button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../../ui/Select";
import { cn } from "../../../lib/utils";
import { getExpectedNominalSalary } from "../../../utils/salaryScale";
import { cleanText } from '../../../utils/profileUtils';
import { validateFinancialRecord } from "../../../utils/payrollValidation";

// Lazy load heavy admin modals
const ProfileDataUpdater = React.lazy(() => import('../ProfileDataUpdater').then(m => ({ default: m.ProfileDataUpdater })));
const FinancialDataUpdater = React.lazy(() => import('../FinancialDataUpdater').then(m => ({ default: m.FinancialDataUpdater })));
const UniversalPatcher = React.lazy(() => import('../UniversalPatcher').then(m => ({ default: m.UniversalPatcher })));
const FixLeaveBalanceModal = React.lazy(() => import('../FixLeaveBalanceModal').then(m => ({ default: m.FixLeaveBalanceModal })));
const FieldPermissionsModal = React.lazy(() => import('../FieldPermissionsModal').then(m => ({ default: m.FieldPermissionsModal })));
const RequestsTabPermissionsModal = React.lazy(() => import('../RequestsTabPermissionsModal').then(m => ({ default: m.RequestsTabPermissionsModal })));
const SnapshotBrowser = React.lazy(() => import('../../snapshots/SnapshotBrowser').then(m => ({ default: m.SnapshotBrowser })));


interface TabManageEmployeesProps {
    selectedEmployee: any;
    setSelectedEmployee: (val: any) => void;
    detailsRef: React.RefObject<HTMLDivElement | null>;
    activeManageSubTab: 'main_info' | 'allowances_deductions' | 'admin_records';
    financialData: any;
    setFinancialData: (val: any) => void;
    isFieldReadOnly: (key: string) => boolean;
    isRoleEditable: boolean;
    theme: 'light' | 'dark';
    financialFields: any;
    handleFinancialChange: (key: string, value: any) => void;
    currentUser: any;
    showSmartUpdater: boolean;
    setShowSmartUpdater: (val: boolean) => void;
    showFieldPermissionsModal: boolean;
    setShowFieldPermissionsModal: (val: boolean) => void;
    showRequestsPermissionsModal: boolean;
    setShowRequestsPermissionsModal: (val: boolean) => void;
    showFixBalanceModal: boolean;
    setShowFixBalanceModal: (val: boolean) => void;
    showFinancialUpdater: boolean;
    setShowFinancialUpdater: (val: boolean) => void;
    showProfileUpdater: boolean;
    setShowProfileUpdater: (val: boolean) => void;
    fetchFieldPermissions: () => Promise<void>;
    yearlyData: any[];
    selectedAdminYear: number;
    setSelectedAdminYear: (year: number) => void;
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
    activeFiveYearLeave: any;
    setShowFiveYearLeaveModal: (show: boolean) => void;
    setShowFiveYearLeaveHistoryModal: (show: boolean) => void;
    handleFiveYearLeaveChange: (checked: boolean) => void;
    newFiveYearLeave: any;
    handleNewFiveYearLeaveChange: (field: string, value: string) => void;
    handleCreateFiveYearLeave: () => Promise<void>;
    loading: boolean;
}

export const TabManageEmployees = ({
    selectedEmployee,
    setSelectedEmployee,
    detailsRef,
    activeManageSubTab,
    financialData,
    setFinancialData,
    isFieldReadOnly,
    isRoleEditable,
    theme,
    financialFields,
    handleFinancialChange,
    currentUser,
    showSmartUpdater,
    setShowSmartUpdater,
    showFieldPermissionsModal,
    setShowFieldPermissionsModal,
    showRequestsPermissionsModal,
    setShowRequestsPermissionsModal,
    showFixBalanceModal,
    setShowFixBalanceModal,
    showProfileUpdater,
    setShowProfileUpdater,
    showFinancialUpdater,
    setShowFinancialUpdater,
    fetchFieldPermissions,
    yearlyData,
    selectedAdminYear,
    setSelectedAdminYear,
    adminRecords,
    handleSaveRecord,
    handleDeleteRecord,
    openRecordSection,
    handleToggleRecordSection,
    activeFiveYearLeave,
    setShowFiveYearLeaveModal,
    setShowFiveYearLeaveHistoryModal,
    handleFiveYearLeaveChange,
    newFiveYearLeave,
    handleNewFiveYearLeaveChange,
    handleCreateFiveYearLeave,
    loading,
}: TabManageEmployeesProps) => {
    const [showFixSickBalanceModal, setShowFixSickBalanceModal] = React.useState(false);
    const [showSnapshots, setShowSnapshots] = React.useState(false);

    return (
        <div className="space-y-6">
            {selectedEmployee ? (
                <div ref={detailsRef} className="space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-0 scroll-mt-20 w-full px-2 md:container md:mx-auto pb-2">

                    {/* Retiree Honor Banner */}
                    {selectedEmployee.is_retired && (
                        <div className="mb-2 p-3 rounded-2xl bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent border-2 border-amber-500/40 flex items-center justify-between gap-3 text-amber-900 dark:text-amber-200 animate-in fade-in duration-300">
                            <div className="flex items-center gap-2.5 text-xs font-bold">
                                <span className="text-xl">🎖️</span>
                                <div>
                                    <div className="font-black text-sm">الموظف محال للتقاعد {selectedEmployee.retirement_date ? `(بتاريخ ${selectedEmployee.retirement_date})` : ''}</div>
                                    <div className="text-[11px] text-amber-700 dark:text-amber-300 font-normal mt-0.5">
                                        الحساب معفى من البصمة ومحفوظ في الأرشيف
                                    </div>
                                </div>
                            </div>
                            {selectedEmployee.retirement_note && (
                                <div className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-[11px] font-bold text-amber-800 dark:text-amber-200 truncate max-w-[280px]">
                                    الأمر: {selectedEmployee.retirement_note}
                                </div>
                            )}
                        </div>
                    )}

                    {activeManageSubTab === 'main_info' && (
                    <div className="p-4 sm:p-5 rounded-2xl border border-teal-500/25 bg-white/85 dark:bg-slate-900/70 backdrop-blur-md shadow-sm space-y-4 animate-in fade-in duration-300">
                        {/* Main Info Fields */}
                        <div className="grid grid-cols-1 gap-4">
                            <EditableField
                                label="الاسم الكامل"
                                value={selectedEmployee.full_name}
                                onChange={(val: string) => setSelectedEmployee({ ...selectedEmployee, full_name: val })}
                                recordId={selectedEmployee.id}
                                tableName="profiles"
                                dbField="full_name"
                                isReadOnly={isFieldReadOnly('full_name')}
                            />

                            <EditableField
                                label="الرقم الوظيفي"
                                value={selectedEmployee.job_number}
                                onChange={(val: string) => setSelectedEmployee({ ...selectedEmployee, job_number: val })}
                                recordId={selectedEmployee.id}
                                tableName="profiles"
                                dbField="job_number"
                                isReadOnly={isFieldReadOnly('job_number')}
                                className="font-mono text-left"
                            />

                            <EditableField
                                label="اسم الأم"
                                value={selectedEmployee.mother_name}
                                onChange={(val: string) => setSelectedEmployee({ ...selectedEmployee, mother_name: val })}
                                recordId={selectedEmployee.id}
                                tableName="profiles"
                                dbField="mother_name"
                                isReadOnly={isFieldReadOnly('mother_name')}
                            />

                            <EditableField
                                label="رقم الهاتف"
                                value={selectedEmployee.phone_number}
                                onChange={(val: string) => setSelectedEmployee({ ...selectedEmployee, phone_number: val })}
                                recordId={selectedEmployee.id}
                                tableName="profiles"
                                dbField="phone_number"
                                isReadOnly={isFieldReadOnly('phone_number')}
                                className="font-mono text-left"
                            />

                            {/* Gender and Birth Date */}
                            <div className="grid grid-cols-[132px_1fr] items-center gap-2">
                                <div className="flex justify-start pl-2">
                                    <label className="text-xs font-bold block text-muted-foreground text-right w-full">الجنس</label>
                                </div>
                                <div className="flex items-center gap-2 relative">
                                    <div className="w-6 shrink-0" />
                                    <div className="flex gap-4 flex-1">
                                        <Button
                                            type="button"
                                            variant={selectedEmployee.gender === 'male' ? 'default' : 'outline'}
                                            onClick={() => setSelectedEmployee({ ...selectedEmployee, gender: 'male' })}
                                            className="flex-1 gap-2"
                                            disabled={isFieldReadOnly('gender')}
                                        >
                                            ذكر
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={selectedEmployee.gender === 'female' ? 'default' : 'outline'}
                                            onClick={() => setSelectedEmployee({ ...selectedEmployee, gender: 'female' })}
                                            className="flex-1 gap-2"
                                            disabled={isFieldReadOnly('gender')}
                                        >
                                            أنثى
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-[132px_1fr] items-center gap-2">
                                <div className="flex justify-start pl-2">
                                    <label className="text-xs font-bold block text-muted-foreground text-right w-full">تاريخ الميلاد</label>
                                </div>
                                <div className="flex items-center gap-2 relative">
                                    <div className="w-6 shrink-0" />
                                    <div className="flex-1">
                                        <DateInput
                                            value={selectedEmployee.birth_date || ""}
                                            onChange={(val: string) => setSelectedEmployee({ ...selectedEmployee, birth_date: val })}
                                            placeholder="dd/mm/yyyy"
                                            disabled={isFieldReadOnly('birth_date')}
                                            className="text-center font-mono"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="px-2">
                                <DepartmentSelector
                                    value={selectedEmployee.department_id}
                                    onChange={(val: string | null, dept?: any, parentDept?: any) => {
                                        const updates: any = { department_id: val };
                                        if (dept) {
                                            const govName = selectedEmployee.governorate === 'babil' ? 'بابل' : selectedEmployee.governorate === 'najaf' ? 'النجف' : 'كربلاء';
                                            if (dept.level === 1 || dept.level === 2) {
                                                updates.dept_text = govName;
                                                updates.section_text = dept.name;
                                                updates.unit_text = '';
                                            } else if (dept.level === 4) {
                                                updates.section_text = dept.name;
                                                if (parentDept) {
                                                    updates.dept_text = (parentDept.level && parentDept.level <= 2) ? govName : parentDept.name;
                                                } else {
                                                    updates.dept_text = govName;
                                                }
                                            } else if (dept.level === 3) {
                                                const isSecOrComplex = dept.name.startsWith('شعبة') ||
                                                    dept.name.startsWith('شعبه') ||
                                                    dept.name.startsWith('الشعبة') ||
                                                    dept.name.startsWith('مجمع');
                                                if (isSecOrComplex) {
                                                    updates.dept_text = govName;
                                                    updates.section_text = dept.name;
                                                    updates.unit_text = '';
                                                } else {
                                                    updates.dept_text = dept.name;
                                                    updates.section_text = '';
                                                    updates.unit_text = '';
                                                }
                                            } else if (dept.level === 5) {
                                                updates.unit_text = dept.name;
                                                if (parentDept) updates.section_text = parentDept.name;
                                            }
                                        }
                                        setSelectedEmployee((prev: any) => ({ ...prev, ...updates }));
                                    }}
                                    theme={theme}
                                />
                                <p className="text-[10px] text-gray-500 mt-1 dark:text-gray-400">
                                    ملاحظة: يمكنك تعيينه كصاحب ارتباط إداري من خلال تبويبة "الهيكلية الإدارية"
                                </p>
                            </div>

                            {/* Role Selection (Refactored) */}
                            <div className="grid grid-cols-1 md:grid-cols-[132px_1fr] items-center gap-2">
                                {/* Label */}
                                <div className="flex justify-start pl-2">
                                    <label className="text-xs font-bold block text-muted-foreground text-right w-full">نوع الحساب</label>
                                </div>

                                {/* Input Area + Spacer */}
                                <div className="flex items-center gap-2 relative">
                                    <div className="hidden md:block w-6 shrink-0" />

                                    <div className="flex gap-4 flex-1">
                                        <Button
                                            type="button"
                                            variant={selectedEmployee.role === 'user' ? 'default' : 'outline'}
                                            onClick={() => setSelectedEmployee({ ...selectedEmployee, role: 'user' })}
                                            className="flex-1 gap-2"
                                            disabled={!isRoleEditable}
                                        >
                                            <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", selectedEmployee.role === 'user' ? "border-white" : "border-muted-foreground")}>
                                                {selectedEmployee.role === 'user' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                            </div>
                                            موظف
                                        </Button>

                                        <Button
                                            type="button"
                                            variant={selectedEmployee.role === 'admin' ? 'default' : 'outline'}
                                            onClick={() => setSelectedEmployee({ ...selectedEmployee, role: 'admin' })}
                                            className="flex-1 gap-2"
                                            disabled={!isRoleEditable}
                                        >
                                            <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", selectedEmployee.role === 'admin' ? "border-white" : "border-muted-foreground")}>
                                                {selectedEmployee.role === 'admin' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                            </div>
                                            مشرف
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Employment & Retirement Status */}
                            <div className="grid grid-cols-1 md:grid-cols-[132px_1fr] items-center gap-2">
                                <div className="flex justify-start pl-2">
                                    <label className="text-xs font-bold block text-muted-foreground text-right w-full">الوضع الوظيفي</label>
                                </div>

                                <div className="flex items-center gap-2 relative">
                                    <div className="hidden md:block w-6 shrink-0" />

                                    <div className="flex gap-4 flex-1">
                                        <Button
                                            type="button"
                                            variant={!selectedEmployee.is_retired ? 'default' : 'outline'}
                                            onClick={() => setSelectedEmployee({ ...selectedEmployee, is_retired: false })}
                                            className={cn(
                                                "flex-1 gap-2 transition-all",
                                                !selectedEmployee.is_retired ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                            )}
                                            disabled={!isRoleEditable}
                                        >
                                            <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", !selectedEmployee.is_retired ? "border-white" : "border-muted-foreground")}>
                                                {!selectedEmployee.is_retired && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                            </div>
                                            مستمر بالخدمة
                                        </Button>

                                        <Button
                                            type="button"
                                            variant={selectedEmployee.is_retired ? 'default' : 'outline'}
                                            onClick={() => {
                                                const todayStr = new Date().toISOString().split('T')[0];
                                                setSelectedEmployee({
                                                    ...selectedEmployee,
                                                    is_retired: true,
                                                    retirement_date: selectedEmployee.retirement_date || todayStr
                                                });
                                            }}
                                            className={cn(
                                                "flex-1 gap-2 transition-all",
                                                selectedEmployee.is_retired 
                                                    ? "bg-amber-600 hover:bg-amber-700 text-white shadow-sm" 
                                                    : "border-amber-400 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                                            )}
                                            disabled={!isRoleEditable}
                                        >
                                            <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", selectedEmployee.is_retired ? "border-white" : "border-amber-500")}>
                                                {selectedEmployee.is_retired && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                            </div>
                                            🎖️ محال للتقاعد
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Details when retired */}
                            {selectedEmployee.is_retired && (
                                <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs">
                                        <span>🎖️</span>
                                        <span>بيانات الإحالة إلى التقاعد</span>
                                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-normal">
                                            (يُعفى الموظف من البصمة اعتباراً من هذا التاريخ وتُحفظ كافة سجلاته التاريخية)
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-[132px_1fr] items-center gap-2">
                                        <div className="flex justify-start pl-2">
                                            <label className="text-xs font-bold block text-muted-foreground text-right w-full">تاريخ التقاعد</label>
                                        </div>
                                        <div className="flex items-center gap-2 relative">
                                            <div className="hidden md:block w-6 shrink-0" />
                                            <div className="flex-1">
                                                <DateInput
                                                    value={selectedEmployee.retirement_date || ""}
                                                    onChange={(val: string) => setSelectedEmployee({ ...selectedEmployee, retirement_date: val })}
                                                    placeholder="dd/mm/yyyy"
                                                    disabled={!isRoleEditable}
                                                    className="text-center font-mono"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-[132px_1fr] items-center gap-2">
                                        <div className="flex justify-start pl-2">
                                            <label className="text-xs font-bold block text-muted-foreground text-right w-full">الأمر الإداري / الملاحظات</label>
                                        </div>
                                        <div className="flex items-center gap-2 relative">
                                            <div className="hidden md:block w-6 shrink-0" />
                                            <Input
                                                type="text"
                                                value={selectedEmployee.retirement_note || ""}
                                                onChange={(e) => setSelectedEmployee({ ...selectedEmployee, retirement_note: e.target.value })}
                                                placeholder="رقم وتاريخ الأمر الإداري للإحالة للتقاعد..."
                                                disabled={!isRoleEditable}
                                                className="flex-1 text-right"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Removed IBAN */}

                            {/* Auth Info */}
                            <div className="grid grid-cols-[132px_1fr] items-center gap-2">
                                {/* Label */}
                                <div className="flex justify-start pl-2">
                                    <label className="text-xs font-bold block text-muted-foreground text-right w-full">اسم المستخدم</label>
                                </div>

                                {/* Input Area + Spacer */}
                                <div className="flex items-center gap-2 relative">
                                    <div className="w-6 shrink-0" />

                                    <Input
                                        type="text"
                                        value={selectedEmployee.username || ""}
                                        onChange={(e) => setSelectedEmployee({ ...selectedEmployee, username: e.target.value })}
                                        placeholder="اسم المستخدم"
                                        dir="ltr"
                                        className="font-mono text-left flex-1"
                                        disabled={isFieldReadOnly('username')}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-[132px_1fr] items-center gap-2">
                                {/* Label */}
                                <div className="flex justify-start pl-2">
                                    <label className="text-xs font-bold block text-muted-foreground text-right w-full">كلمة المرور المؤقتة</label>
                                </div>

                                {/* Input Area + Spacer */}
                                <div className="flex items-center gap-2 relative">
                                    <div className="w-6 shrink-0" />

                                    <Input
                                        type="text"
                                        value={selectedEmployee.password || ""}
                                        onChange={(e) => setSelectedEmployee({ ...selectedEmployee, password: e.target.value })}
                                        placeholder="كلمة المرور"
                                        dir="ltr"
                                        className="font-mono text-left flex-1"
                                        disabled={isFieldReadOnly('password')}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* فاصل ودمج معلومات الدرجة الوظيفية داخل المعلومات الأساسية */}
                        <div className="pt-4 mt-4 border-t-2 border-dashed border-purple-500/25 space-y-4">
                            <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-300">
                                <User className="w-4 h-4 shrink-0" />
                                <span className="text-xs font-extrabold">معلومات الدرجة الوظيفية</span>
                            </div>
                            {/* Start Date */}
                            {/* Appointment Date */}
                            <EditableField
                                label="تاريخ التعيين"
                                value={selectedEmployee.appointment_date}
                                onChange={(val: string) => setSelectedEmployee({ ...selectedEmployee, appointment_date: val })}
                                recordId={selectedEmployee.id}
                                tableName="profiles"
                                dbField="appointment_date"
                                type="text"
                                isReadOnly={isFieldReadOnly('appointment_date')}
                            />

                            {/* Job Title and Risk % */}
                            <div className="grid grid-cols-1 gap-4 mt-4">
                                <FinancialInput financialData={financialData}
                                    key="job_title"
                                    field={financialFields.basic.find((f: any) => f.key === 'job_title')}
                                    value={financialData?.job_title}
                                    onChange={handleFinancialChange}
                                    recordId={financialData?.id}
                                    tableName="financial_records"
                                    dbField="job_title"
                                    isReadOnly={isFieldReadOnly("job_title")}
                                />
                                <FinancialInput financialData={financialData}
                                    key="risk_percentage"
                                    field={financialFields.basic.find((f: any) => f.key === 'risk_percentage')}
                                    value={financialData?.risk_percentage}
                                    onChange={handleFinancialChange}
                                    recordId={financialData?.id}
                                    tableName="financial_records"
                                    dbField="risk_percentage"
                                    isReadOnly={isFieldReadOnly("risk_percentage")}
                                />
                            </div>

                            {/* New Profile Fields */}
                            <div className="grid grid-cols-1 gap-4 mt-4">
                                <EditableField
                                    label="المنصب الإداري"
                                    value={selectedEmployee.position_title}
                                    onChange={(val: string) => setSelectedEmployee({ ...selectedEmployee, position_title: val })}
                                    recordId={selectedEmployee.id}
                                    tableName="profiles"
                                    dbField="position_title"
                                    isReadOnly={isFieldReadOnly('position_title')}
                                />
                                <EditableField
                                    label="الاختصاص العام"
                                    value={selectedEmployee.general_specialization}
                                    onChange={(val: string) => setSelectedEmployee({ ...selectedEmployee, general_specialization: val })}
                                    recordId={selectedEmployee.id}
                                    tableName="profiles"
                                    dbField="general_specialization"
                                    isReadOnly={isFieldReadOnly('general_specialization')}
                                />
                                <EditableField
                                    label="التخصص (PROF)"
                                    value={selectedEmployee.specialization}
                                    onChange={(val: string) => setSelectedEmployee({ ...selectedEmployee, specialization: val })}
                                    recordId={selectedEmployee.id}
                                    tableName="profiles"
                                    dbField="specialization"
                                    isReadOnly={isFieldReadOnly('specialization')}
                                />
                                <EditableField
                                    label="سنة التخرج"
                                    value={selectedEmployee.graduation_year}
                                    onChange={(val: string) => setSelectedEmployee({ ...selectedEmployee, graduation_year: val })}
                                    recordId={selectedEmployee.id}
                                    tableName="profiles"
                                    dbField="graduation_year"
                                    isReadOnly={isFieldReadOnly('graduation_year')}
                                />
                                <EditableField
                                    label="طبيعة العمل"
                                    value={selectedEmployee.work_nature}
                                    onChange={(val: string) => setSelectedEmployee({ ...selectedEmployee, work_nature: val })}
                                    recordId={selectedEmployee.id}
                                    tableName="profiles"
                                    dbField="work_nature"
                                    isReadOnly={isFieldReadOnly('work_nature')}
                                />
                                <EditableField
                                    label="القسم"
                                    value={cleanText(selectedEmployee.dept_text)}
                                    onChange={(val: string) => setSelectedEmployee({ ...selectedEmployee, dept_text: val })}
                                    recordId={selectedEmployee.id}
                                    tableName="profiles"
                                    dbField="dept_text"
                                    isReadOnly={isFieldReadOnly('dept_text')}
                                />
                                <EditableField
                                    label="الشعبة"
                                    value={cleanText(selectedEmployee.section_text)}
                                    onChange={(val: string) => setSelectedEmployee({ ...selectedEmployee, section_text: val })}
                                    recordId={selectedEmployee.id}
                                    tableName="profiles"
                                    dbField="section_text"
                                    isReadOnly={isFieldReadOnly('section_text')}
                                />
                                <EditableField
                                    label="الوحدة"
                                    value={cleanText(selectedEmployee.unit_text)}
                                    onChange={(val: string) => setSelectedEmployee({ ...selectedEmployee, unit_text: val })}
                                    recordId={selectedEmployee.id}
                                    tableName="profiles"
                                    dbField="unit_text"
                                    isReadOnly={isFieldReadOnly('unit_text')}
                                />
                                <EditableField
                                    label="تاريخ الترك"
                                    value={selectedEmployee.leave_date}
                                    onChange={(val: string) => setSelectedEmployee({ ...selectedEmployee, leave_date: val })}
                                    recordId={selectedEmployee.id}
                                    tableName="profiles"
                                    dbField="leave_date"
                                    isReadOnly={isFieldReadOnly('leave_date')}
                                />
                                <EditableField
                                    label="تاريخ الإعادة"
                                    value={selectedEmployee.reinstatement_date}
                                    onChange={(val: string) => setSelectedEmployee({ ...selectedEmployee, reinstatement_date: val })}
                                    recordId={selectedEmployee.id}
                                    tableName="profiles"
                                    dbField="reinstatement_date"
                                    isReadOnly={isFieldReadOnly('reinstatement_date')}
                                />
                                <EditableField
                                    label="نوع الإعادة"
                                    value={selectedEmployee.reinstatement_type}
                                    onChange={(val: string) => setSelectedEmployee({ ...selectedEmployee, reinstatement_type: val })}
                                    recordId={selectedEmployee.id}
                                    tableName="profiles"
                                    dbField="reinstatement_type"
                                    isReadOnly={isFieldReadOnly('reinstatement_type')}
                                />
                            </div>

                            {/* Row 2: Grade and Stage - Vertical Stack */}
                            <div className="grid grid-cols-1 gap-4">
                                <FinancialInput financialData={financialData}
                                    key="salary_grade"
                                    field={{ ...financialFields.basic.find((f: any) => f.key === 'salary_grade'), label: "الدرجة الوظيفية" }}
                                    value={financialData?.salary_grade}
                                    onChange={handleFinancialChange}
                                    recordId={financialData?.id}
                                    tableName="financial_records"
                                    dbField="salary_grade"
                                    isReadOnly={isFieldReadOnly("salary_grade")}
                                />

                                {/* Salary Stage (المرحلة) */}
                                <div className="grid grid-cols-[132px_1fr] items-center gap-2">
                                    <div className="flex justify-start pl-2">
                                        <label className="text-xs font-bold block whitespace-nowrap text-muted-foreground text-right w-full">المرحلة</label>
                                    </div>

                                    <div className="flex items-center gap-2 relative">
                                        <div className="w-6 shrink-0 flex justify-center">
                                            {financialData?.id && (
                                                <HistoryViewer
                                                    tableName="financial_records"
                                                    recordId={financialData.id}
                                                    fieldName="salary_stage"
                                                    label="المرحلة"
                                                />
                                            )}
                                        </div>

                                        <div className="relative flex-1">
                                            <Select
                                                value={financialData?.['salary_stage']?.toString() || ""}
                                                onValueChange={(val) => setFinancialData({ ...(financialData || {}), 'salary_stage': val })}
                                                disabled={isFieldReadOnly('salary_stage')}
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="اختر..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {Array.from({ length: 25 }, (_, i) => i + 1).map(num => (
                                                        <SelectItem key={num} value={num.toString()}>{num}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Row 3: Certificate Text */}
                            <FinancialInput financialData={financialData}
                                key="certificate_text"
                                field={financialFields.basic.find((f: any) => f.key === 'certificate_text')}
                                value={financialData?.certificate_text}
                                onChange={handleFinancialChange}
                                recordId={financialData?.id}
                                tableName="financial_records"
                                dbField="certificate_text"
                                isReadOnly={isFieldReadOnly("certificate_text")}
                            />

                            {/* Row 4: Certificate Percentage & Nominal Salary */}
                            <div className="grid grid-cols-1 gap-4">
                                <div className="relative">
                                    <FinancialInput financialData={financialData}
                                        key="nominal_salary"
                                        field={financialFields.basic.find((f: any) => f.key === 'nominal_salary')}
                                        value={financialData?.nominal_salary}
                                        onChange={handleFinancialChange}
                                        recordId={financialData?.id}
                                        tableName="financial_records"
                                        dbField="nominal_salary"
                                        isReadOnly={isFieldReadOnly("nominal_salary")}
                                    />
                                    {financialData?.salary_grade && financialData?.salary_stage && getExpectedNominalSalary(financialData.salary_grade, financialData.salary_stage) !== null && (
                                        <div className="flex items-center gap-2 mt-1 mb-2 text-xs mr-[140px] pr-2">
                                            {Number(financialData.nominal_salary) === getExpectedNominalSalary(financialData.salary_grade, financialData.salary_stage) ? (
                                                <span className="text-green-600 dark:text-green-400 font-medium flex items-center gap-1 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded border border-green-200 dark:border-green-800">
                                                    <CheckCircle size={12} /> مطابق لسلم الرواتب
                                                </span>
                                            ) : (
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                                                        <AlertCircle size={12} /> غير مطابق (المستحق: {getExpectedNominalSalary(financialData.salary_grade, financialData.salary_stage)?.toLocaleString()})
                                                    </span>
                                                    {!isFieldReadOnly("nominal_salary") && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setFinancialData({ ...financialData, nominal_salary: getExpectedNominalSalary(financialData.salary_grade, financialData.salary_stage) })}
                                                            className="text-white bg-amber-500 hover:bg-amber-600 px-2 py-1 rounded-md text-[11px] transition font-bold shadow-sm"
                                                        >
                                                            تحديث وتصحيح
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <FinancialInput financialData={financialData}
                                    key="certificate_percentage"
                                    field={{ ...financialFields.basic.find((f: any) => f.key === 'certificate_percentage')!, label: "نسبة م.الشهادة" }}
                                    value={financialData?.certificate_percentage}
                                    onChange={handleFinancialChange}
                                    recordId={financialData?.id}
                                    tableName="financial_records"
                                    dbField="certificate_percentage"
                                    isReadOnly={isFieldReadOnly("certificate_percentage")}
                                />
                            </div>

                            {/* الراتب الكلي والصافي */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-dashed border-gray-200 dark:border-white/10">
                                <FinancialInput financialData={financialData}
                                    key="gross_salary"
                                    // @ts-ignore
                                    field={{ key: 'gross_salary', label: 'الراتب الاجمالي (قبل الاستقطاع)', type: 'number' }}
                                    value={financialData?.gross_salary}
                                    onChange={handleFinancialChange}
                                    recordId={financialData?.id}
                                    tableName="financial_records"
                                    dbField="gross_salary"
                                    isReadOnly={isFieldReadOnly("gross_salary")}
                                />
                                <FinancialInput financialData={financialData}
                                    key="net_salary"
                                    // @ts-ignore
                                    field={{ key: 'net_salary', label: 'الراتب الصافي (مستحق الدفع)', type: 'number' }}
                                    value={financialData?.net_salary}
                                    onChange={handleFinancialChange}
                                    recordId={financialData?.id}
                                    tableName="financial_records"
                                    dbField="net_salary"
                                    isReadOnly={isFieldReadOnly("net_salary")}
                                />
                            </div>
                        </div>
                    </div>
                    )}

                    {activeManageSubTab === 'allowances_deductions' && (
                    <div className="p-4 sm:p-5 rounded-2xl border border-emerald-500/25 bg-white/85 dark:bg-slate-900/70 backdrop-blur-md shadow-sm space-y-5 animate-in fade-in duration-300">
                            {/* المخصصات أولاً */}
                            <div className="space-y-4 p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 border-b border-emerald-500/15 pb-2">
                                    <Wallet className="w-4 h-4 shrink-0" />
                                    <span className="text-xs font-extrabold">المخصصات</span>
                                </div>
                                <div className="grid grid-cols-1 gap-4">
                                    {financialFields.allowances.map((field: any) => (
                                        <FinancialInput financialData={financialData}
                                            key={field.key}
                                            field={field}
                                            value={financialData?.[field.key]}
                                            onChange={handleFinancialChange}
                                            recordId={financialData?.id}
                                            tableName="financial_records"
                                            dbField={field.key}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* الاستقطاعات ثانياً */}
                            <div className="space-y-4 p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/5">
                                <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 border-b border-rose-500/15 pb-2">
                                    <Scissors className="w-4 h-4 shrink-0" />
                                    <span className="text-xs font-extrabold">الاستقطاعات</span>
                                </div>
                                <div className="grid grid-cols-1 gap-4">
                                    {financialFields.deductions.map((field: any) => (
                                        <FinancialInput financialData={financialData}
                                            key={field.key}
                                            field={field}
                                            value={financialData?.[field.key]}
                                            onChange={handleFinancialChange}
                                            recordId={financialData?.id}
                                            tableName="financial_records"
                                            dbField={field.key}
                                        />
                                    ))}
                                </div>
                            </div>
                    </div>
                    )}

                    {activeManageSubTab === 'admin_records' && (
                    <div className="p-3.5 sm:p-5 rounded-2xl border border-blue-500/25 bg-white/85 dark:bg-slate-900/70 backdrop-blur-md shadow-sm animate-in fade-in duration-300">
                        <TabAdminRecords
                            embedded={true}
                            selectedEmployee={selectedEmployee}
                            yearlyData={yearlyData}
                            selectedAdminYear={selectedAdminYear}
                            setSelectedAdminYear={setSelectedAdminYear}
                            adminRecords={adminRecords}
                            handleSaveRecord={handleSaveRecord}
                            handleDeleteRecord={handleDeleteRecord}
                            openRecordSection={openRecordSection}
                            handleToggleRecordSection={handleToggleRecordSection}
                            isFieldReadOnly={isFieldReadOnly}
                            activeFiveYearLeave={activeFiveYearLeave}
                            setShowFiveYearLeaveModal={setShowFiveYearLeaveModal}
                            setShowFiveYearLeaveHistoryModal={setShowFiveYearLeaveHistoryModal}
                            financialData={financialData}
                            handleFiveYearLeaveChange={handleFiveYearLeaveChange}
                            newFiveYearLeave={newFiveYearLeave}
                            handleNewFiveYearLeaveChange={handleNewFiveYearLeaveChange}
                            handleCreateFiveYearLeave={handleCreateFiveYearLeave}
                            loading={loading}
                        />
                    </div>
                    )}
                </div>
            ) : (
                <div className="pt-2 pb-2">
                    <div className="flex flex-wrap justify-center gap-4">
                        <Button
                            variant="outline"
                            onClick={() => setShowSmartUpdater(true)}
                                    className="gap-2 border-blue-500/50 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-black shadow-sm transition-all"
                                >
                                    <DatabaseZap className="w-4 h-4 text-blue-500" />
                                    المحدث العام ⚡ — الأداة الأساسية
                                </Button>

                                <Button
                                    variant="outline"
                                    onClick={() => setShowFinancialUpdater(true)}
                                    className="gap-2 border-border/50 hover:bg-muted/20 text-foreground bg-white/50 border-green-500/30 font-bold"
                                >
                                    <FileSpreadsheet className="w-4 h-4 text-green-500" />
                                    تحديث بيانات الراتب
                                </Button>

                                <Button
                                    variant="outline"
                                    onClick={() => setShowProfileUpdater(true)}
                                    className="gap-2 border-border/50 hover:bg-muted/20 text-foreground bg-white/50 border-teal-500/30 font-bold"
                                >
                                    <FileSpreadsheet className="w-4 h-4 text-teal-500" />
                                    تحديث المعلومات الأساسية
                                </Button>

                                <Button
                                    variant="outline"
                                    onClick={() => setShowSnapshots(true)}
                                    className="gap-2 border-border/50 hover:bg-muted/20 hover:border-indigo-500/50 text-foreground bg-white/50 transition-all font-bold shadow-sm"
                                >
                                    <History className="w-4 h-4 text-indigo-500" />
                                    النسخ الشهرية والتصحيح 📅
                                </Button>

                                <Button
                                    variant="outline"
                                    onClick={() => setShowFieldPermissionsModal(true)}
                                    className="gap-2 border-border/50 hover:bg-muted/20 text-foreground bg-white/50"
                                >
                                    <Shield className="w-4 h-4 text-amber-500" />
                                    الحقول حسب الصلاحية
                                </Button>

                                <Button
                                    variant="outline"
                                    onClick={() => setShowRequestsPermissionsModal(true)}
                                    className="gap-2 border-border/50 hover:bg-muted/20 text-foreground bg-white/50"
                                >
                                    <ClipboardCheck className="w-4 h-4 text-purple-500" />
                                    تحديد مستخدمي تبويبة الطلبات
                                </Button>

                                {currentUser?.job_number === '103130486' && (
                                    <>
                                        <Button
                                            variant="outline"
                                            onClick={() => setShowFixBalanceModal(true)}
                                            className="gap-2 border-border/50 hover:bg-muted/20 hover:border-rose-500/50 text-foreground bg-white/50 transition-all font-bold shadow-sm text-green-600 dark:text-green-400"
                                        >
                                            <ShieldAlert className="w-4 h-4 text-green-500" />
                                            إصلاح الرصيد (اعتيادية)
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() => setShowFixSickBalanceModal(true)}
                                            className="gap-2 border-border/50 hover:bg-muted/20 hover:border-rose-500/50 text-foreground bg-white/50 transition-all font-bold shadow-sm"
                                        >
                                            <ShieldAlert className="w-4 h-4 text-rose-500" />
                                            إصلاح الرصيد (مرضية)
                                        </Button>
                                    </>
                                )}
                            </div>
                            <React.Suspense fallback={
                                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 pb-28 md:pb-32 overflow-y-auto animate-in fade-in duration-200">
                                    <div className="bg-card p-5 rounded-2xl border shadow-2xl flex items-center gap-3 text-foreground">
                                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                        <span className="font-semibold text-sm">جاري تحميل الأداة...</span>
                                    </div>
                                </div>
                            }>
                                {showRequestsPermissionsModal && (
                                    <RequestsTabPermissionsModal
                                        onClose={() => setShowRequestsPermissionsModal(false)}
                                        theme={theme}
                                    />
                                )}
                                {showFinancialUpdater && (
                                    <FinancialDataUpdater 
                                        onClose={() => setShowFinancialUpdater(false)} 
                                        theme={theme}
                                    />
                                )}
                                {showProfileUpdater && (
                                    <ProfileDataUpdater 
                                        onClose={() => setShowProfileUpdater(false)} 
                                        theme={theme}
                                    />
                                )}
                                {showFixBalanceModal && (
                                    <FixLeaveBalanceModal onClose={() => setShowFixBalanceModal(false)} type="regular" />
                                )}
                                {showFixSickBalanceModal && (
                                    <FixLeaveBalanceModal onClose={() => setShowFixSickBalanceModal(false)} type="sick" />
                                )}
                                {showSmartUpdater && (
                                    <UniversalPatcher onClose={() => setShowSmartUpdater(false)} />
                                )}
                                {showSnapshots && (
                                    <SnapshotBrowser isOpen={showSnapshots} onClose={() => setShowSnapshots(false)} />
                                )}
                                {showFieldPermissionsModal && (
                                    <FieldPermissionsModal
                                        onClose={() => {
                                            setShowFieldPermissionsModal(false);
                                            fetchFieldPermissions();
                                        }}
                                        theme={theme}
                                    />
                                )}
                            </React.Suspense>
                    </div>
                )}
        </div>
    );
};

// Internal components to avoid cluttering AdminDashboard
function EditableField({
    label,
    value,
    onChange,
    recordId,
    tableName,
    dbField,
    isReadOnly,
    type = "text",
    className = ""
}: any) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-[132px_1fr] items-center gap-1.5 sm:gap-2">
            <div className="flex justify-start sm:pl-2">
                <label className="text-xs font-bold block whitespace-nowrap text-muted-foreground text-right w-full">{label}</label>
            </div>

            <div className="flex items-center gap-2 relative">
                <div className="w-6 shrink-0 flex justify-center">
                    {recordId && tableName && dbField && (
                        <HistoryViewer
                            tableName={tableName}
                            recordId={recordId}
                            fieldName={dbField}
                            label={label}
                        />
                    )}
                </div>

                <Input
                    type={type}
                    value={value || ""}
                    onChange={(e) => onChange(e.target.value)}
                    className={cn("flex-1 text-sm", className)}
                    disabled={isReadOnly}
                />
            </div>
        </div>
    );
}

function FinancialInput({ field, value, onChange, recordId, tableName, dbField, isReadOnly, financialData }: any) {
    if (!field) return null;
    return (
        <div className="grid grid-cols-1 sm:grid-cols-[132px_1fr] items-center gap-1.5 sm:gap-2">
            <div className="flex justify-start sm:pl-2">
                <label className="text-[11px] sm:text-xs font-bold block whitespace-nowrap text-muted-foreground text-right w-full">{field.label}</label>
            </div>

            <div className="flex items-center gap-2 relative w-full">
                <div className="w-6 shrink-0 flex justify-center">
                    {recordId && tableName && (dbField || field.key) && (
                        <HistoryViewer
                            tableName={tableName}
                            recordId={recordId}
                            fieldName={dbField || field.key}
                            label={field.label}
                        />
                    )}
                </div>

                <div className="flex-1 relative">
                    {field.options ? (() => {
                        const normalizedOptions: { value: string; label: string }[] = field.options.map((opt: any) =>
                            typeof opt === 'object' && opt !== null && 'value' in opt
                                ? { value: String(opt.value), label: String(opt.label) }
                                : { value: String(opt), label: String(opt) }
                        );
                        const strVal = (field.key === 'transport_allowance' && (value === 0 || value === '0' || value === null || value === undefined || value === ''))
                            ? '0'
                            : (value !== null && value !== undefined && value !== '') ? String(value) : '';
                        const exists = normalizedOptions.some(o => o.value === strVal);
                        const allOptions = (strVal && !exists)
                            ? [{ value: strVal, label: strVal === '0' ? 'بلا' : strVal }, ...normalizedOptions]
                            : normalizedOptions;
                        return (
                            <Select
                                value={strVal}
                                onValueChange={(val) => onChange(field.key, val)}
                                disabled={field.disabled || isReadOnly}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="اختر..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {allOptions.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        );
                    })() : (
                        <div className="relative w-full">
                            <Input
                                type={field.isMoney ? "number" : "text"}
                                value={value || ""}
                                onChange={(e) => onChange(field.key, e.target.value)}
                                disabled={field.disabled || isReadOnly}
                                className={cn("no-spin w-full text-sm", field.isMoney && "pl-10")}
                            />
                            {field.isMoney && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">د.ع</span>}
                            {field.suffix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">{field.suffix}</span>}
                        </div>
                    )}

                    {financialData && (() => {
                        const validation = validateFinancialRecord(financialData);
                        if (validation.discrepancies[field.key]) {
                            return (
                                <div className="text-red-500 text-[11px] font-bold mt-1 bg-red-500/10 p-1.5 rounded border border-red-500/20 text-center animate-in slide-in-from-top-1">
                                    {validation.discrepancies[field.key]}
                                </div>
                            );
                        }
                        return null;
                    })()}
                </div>
            </div>
        </div>
    );
}
