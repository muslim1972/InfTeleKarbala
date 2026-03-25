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
    Wallet
} from "lucide-react";
import { AccordionSection } from "../../ui/AccordionSection";
import { HistoryViewer } from "../HistoryViewer";
import { DepartmentSelector } from "../DepartmentSelector";
import { Input } from "../../ui/Input";
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
import { ProfileDataUpdater } from '../ProfileDataUpdater';
import { FinancialDataUpdater } from '../FinancialDataUpdater';
import { SmartSalaryUpdater } from '../SmartSalaryUpdater';
import { FixLeaveBalanceModal } from '../FixLeaveBalanceModal';
import { cleanText } from '../../../utils/profileUtils';
import { FieldPermissionsModal } from '../FieldPermissionsModal';
import { RequestsTabPermissionsModal } from '../RequestsTabPermissionsModal';

interface TabManageEmployeesProps {
    selectedEmployee: any;
    setSelectedEmployee: (val: any) => void;
    detailsRef: React.RefObject<HTMLDivElement | null>;
    expandedSections: any;
    toggleSection: (id: string) => void;
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
}

export const TabManageEmployees = ({
    selectedEmployee,
    setSelectedEmployee,
    detailsRef,
    expandedSections,
    toggleSection,
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
}: TabManageEmployeesProps) => {
    return (
        <div className="space-y-6">
            {selectedEmployee ? (
                <div ref={detailsRef} className="space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-0 scroll-mt-20 w-full px-2 md:container md:mx-auto">

                    <AccordionSection
                        id="main_info"
                        title="معلومات اساسية"
                        icon={User}
                        isOpen={expandedSections.main_info}
                        color="from-teal-600 to-teal-500"
                        onToggle={() => toggleSection('main_info')}
                    >
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

                            <div className="px-2">
                                <DepartmentSelector
                                    value={selectedEmployee.department_id}
                                    onChange={(val: string | null) => setSelectedEmployee({ ...selectedEmployee, department_id: val })}
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

                            {/* IBAN */}
                            <EditableField
                                label="IBAN (المصرف)"
                                value={selectedEmployee.iban}
                                onChange={(val: string) => setSelectedEmployee({ ...selectedEmployee, iban: val })}
                                recordId={selectedEmployee.id}
                                tableName="profiles"
                                dbField="iban"
                                isReadOnly={isFieldReadOnly('iban')}
                            />

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
                    </AccordionSection>

                    <AccordionSection
                        id="basic"
                        title="معلومات الدرجة الوظيفية"
                        icon={User}
                        isOpen={expandedSections.basic}
                        color="from-purple-600 to-purple-500"
                        onToggle={() => toggleSection('basic')}
                    >
                        <div className="space-y-4">
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
                                <FinancialInput
                                    key="job_title"
                                    field={financialFields.basic.find((f: any) => f.key === 'job_title')}
                                    value={financialData?.job_title}
                                    onChange={handleFinancialChange}
                                    recordId={financialData?.id}
                                    tableName="financial_records"
                                    dbField="job_title"
                                    isReadOnly={isFieldReadOnly("job_title")}
                                />
                                <FinancialInput
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
                            </div>

                            {/* Row 2: Grade and Stage - Vertical Stack */}
                            <div className="grid grid-cols-1 gap-4">
                                <FinancialInput
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
                            <FinancialInput
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
                                    <FinancialInput
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
                                <FinancialInput
                                    key="certificate_percentage"
                                    field={{ ...financialFields.basic.find((f: any) => f.key === 'certificate_percentage')!, label: "م.الشهادة %" }}
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
                                <FinancialInput
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
                                <FinancialInput
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
                    </AccordionSection>

                    <AccordionSection
                        id="deductions"
                        title="الاستقطاعات"
                        icon={Scissors}
                        isOpen={expandedSections.deductions}
                        color="from-red-600 to-red-500"
                        onToggle={() => toggleSection('deductions')}
                    >
                        <div className="grid grid-cols-1 gap-4">
                            {financialFields.deductions.map((field: any) => (
                                <FinancialInput
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
                    </AccordionSection>

                    <AccordionSection
                        id="allowances"
                        title="المخصصات"
                        icon={Wallet}
                        isOpen={expandedSections.allowances}
                        color="from-green-600 to-green-500"
                        onToggle={() => toggleSection('allowances')}
                    >
                        <div className="grid grid-cols-1 gap-4">
                            {financialFields.allowances.map((field: any) => (
                                <FinancialInput
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
                    </AccordionSection>
                </div>
            ) : (
                <div className="text-center py-20">
                    <div className="p-4 bg-white/50 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4 border border-border/50 shadow-sm">
                        <User className="w-10 h-10 text-muted-foreground/30" />
                    </div>
                    <h3 className="text-foreground font-bold text-xl mb-2">إدارة الموظفين</h3>
                    <p className="text-muted-foreground">يرجى البحث عن موظف بواسطة الرقم الوظيفي لتعديل بياناته</p>

                    {currentUser?.full_name && (currentUser.full_name.includes('مسلم عقيل') || currentUser.full_name.includes('مسلم قيل')) && (
                        <>
                            <div className="mt-8 flex flex-wrap justify-center gap-4">
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
                                    onClick={() => setShowSmartUpdater(true)}
                                    className="gap-2 border-border/50 hover:bg-muted/20 hover:border-blue-500/50 text-foreground bg-white/50 transition-all font-bold shadow-sm"
                                >
                                    <DatabaseZap className="w-4 h-4 text-blue-500" />
                                    المحدث الشهري الذكي
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
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowFixBalanceModal(true)}
                                        className="gap-2 border-border/50 hover:bg-muted/20 hover:border-rose-500/50 text-foreground bg-white/50 transition-all font-bold shadow-sm"
                                    >
                                        <ShieldAlert className="w-4 h-4 text-rose-500" />
                                        إصلاح الرصيد
                                    </Button>
                                )}
                            </div>
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
                                <FixLeaveBalanceModal onClose={() => setShowFixBalanceModal(false)} />
                            )}
                            {showSmartUpdater && (
                                <SmartSalaryUpdater onClose={() => setShowSmartUpdater(false)} />
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
                        </>
                    )}
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
    type = "text"
}: any) {
    return (
        <div className="grid grid-cols-[132px_1fr] items-center gap-2">
            <div className="flex justify-start pl-2">
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
                    className="flex-1"
                    disabled={isReadOnly}
                />
            </div>
        </div>
    );
}

function FinancialInput({ field, value, onChange, recordId, tableName, dbField, isReadOnly }: any) {
    if (!field) return null;
    return (
        <div className="grid grid-cols-[132px_1fr] items-center gap-2">
            <div className="flex justify-start pl-2">
                <label className="text-[10px] md:text-xs font-bold block whitespace-nowrap text-muted-foreground text-right w-full">{field.label}</label>
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
                        const allOptions = (value && !field.options.includes(String(value)))
                            ? [String(value), ...field.options]
                            : field.options;
                        return (
                            <Select
                                value={value?.toString() || ""}
                                onValueChange={(val) => onChange(field.key, val)}
                                disabled={field.disabled || isReadOnly}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="اختر..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {allOptions.map((opt: string) => (
                                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
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
                                className={cn("no-spin w-full", field.isMoney && "pl-10")}
                            />
                            {field.isMoney && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">د.ع</span>}
                            {field.suffix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">{field.suffix}</span>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
