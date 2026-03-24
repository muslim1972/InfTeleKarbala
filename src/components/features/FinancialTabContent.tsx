import { motion, AnimatePresence } from "framer-motion";
import { User, Wallet, Scissors, Calculator, Loader2, Eye, EyeOff } from 'lucide-react';
import { AccordionSection } from "../ui/AccordionSection";
import { SalaryCalculator } from "./SalaryCalculator";
import { formatDateTime } from "../../utils/formatDate";
import { getRoleLabel } from "../../utils/formatRoles";
import { cn } from "../../lib/utils";
import { cleanText } from "../../utils/profileUtils";

interface FinancialField {
    key: string;
    label: string;
    isMoney?: boolean;
    isDate?: boolean;
    suffix?: string;
    highlight?: boolean;
    superHighlight?: boolean;
    isProfile?: boolean;
}

const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.1 }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
};

interface FinancialTabContentProps {
    user: any;
    financialData: any;
    loading: boolean;
    showIban: boolean;
    setShowIban: (val: boolean) => void;
    departmentInfo: { name: string, managerName: string };
    adminData: any;
    openSection: string | null;
    toggleSection: (section: string) => void;
}

export const FinancialTabContent = ({
    user,
    financialData,
    loading,
    showIban,
    setShowIban,
    departmentInfo,
    adminData,
    openSection,
    toggleSection
}: FinancialTabContentProps) => {




    const financialGroups = [
        {
            id: 'basic',
            title: 'المعلومات الاساسية والرواتب',
            icon: User,
            color: 'from-blue-600 to-blue-500',
            fields: [
                { key: 'permission_level', label: 'مستوى الصلاحية', superHighlight: true },
                { key: 'job_number', label: 'الرقم الوظيفي', isProfile: true, superHighlight: true },
                { key: 'full_name', label: 'الاسم الكامل', isProfile: true },
                { key: 'specialization', label: 'التخصص (PROF)', isProfile: true },
                { key: 'graduation_year', label: 'سنة التخرج', isProfile: true },
                { key: 'appointment_date', label: 'تاريخ التعيين', isProfile: true, isDate: true },
                { key: 'work_nature', label: 'طبيعة العمل', isProfile: true },
                { key: 'dept_text', label: 'القسم', isProfile: true },
                { key: 'section_text', label: 'الشعبة', isProfile: true },
                { key: 'unit_text', label: 'الوحدة', isProfile: true },
                { key: 'department_name', label: 'مكان العمل' },
                { key: 'direct_manager', label: 'المسؤول المباشر' },
                { key: 'job_title', label: 'العنوان الوظيفي' },
                { key: 'salary_grade', label: 'الدرجة في سلم الرواتب' },
                { key: 'salary_stage', label: 'المرحلة في الدرجة الوظيفية' },
                { key: 'certificate_text', label: 'الشهادة' },
                { key: 'certificate_percentage', label: 'النسبة المستحقة للشهادة', suffix: '%' },
                { key: 'nominal_salary', label: 'الراتب الاسمي', isMoney: true },
                { key: 'gross_salary', label: 'الراتب قبل الاستقطاع', isMoney: true },
                { key: 'net_salary', label: 'الراتب الصافي', isMoney: true, superHighlight: true },
            ] as FinancialField[]
        },
        {
            id: 'allowances',
            title: 'المخصصات',
            icon: Wallet,
            color: 'from-green-600 to-green-500',
            fields: [
                { key: 'certificate_allowance', label: 'مخصصات الشهادة', isMoney: true },
                { key: 'engineering_allowance', label: 'مخصصات هندسية', isMoney: true },
                { key: 'legal_allowance', label: 'مخصصات القانونية', isMoney: true },
                { key: 'transport_allowance', label: 'مخصصات النقل', isMoney: true },
                { key: 'marital_allowance', label: 'مخصصات الزوجية', isMoney: true },
                { key: 'children_allowance', label: 'مخصصات الاطفال', isMoney: true },
                { key: 'position_allowance', label: 'مخصصات المنصب', isMoney: true },
                { key: 'risk_allowance', label: 'مخصصات الخطورة', isMoney: true },
                { key: 'additional_50_percent_allowance', label: 'مخصصات اضافية 50%', isMoney: true },
                { key: 'total_allowances', label: 'مجموع المخصصات المستحقة', isMoney: true, highlight: true },
            ] as FinancialField[]
        },
        {
            id: 'deductions',
            title: 'الاستقطاعات',
            icon: Scissors,
            color: 'from-red-600 to-red-500',
            fields: [
                { key: 'tax_deduction_status', label: 'حالة الاستقطاع الضريبي' },
                { key: 'tax_deduction_amount', label: 'الاستقطاع الضريبي', isMoney: true },
                { key: 'loan_deduction', label: 'استقطاع مبلغ القرض', isMoney: true },
                { key: 'execution_deduction', label: 'استقطاع مبالغ التنفيذ', isMoney: true },
                { key: 'retirement_deduction', label: 'استقطاع التقاعد', isMoney: true },
                { key: 'school_stamp_deduction', label: 'استقطاع طابع مدرسي', isMoney: true },
                { key: 'social_security_deduction', label: 'استقطاع الحماية الاجتماعية', isMoney: true },
                { key: 'other_deductions', label: 'استقطاع مبلغ مطروح', isMoney: true },
                { key: 'total_deductions', label: 'مجموع الاستقطاعات', isMoney: true, highlight: true },
            ] as FinancialField[]
        },
        {
            id: 'faq',
            title: 'الأسئلة الشائعة والحاسبة',
            icon: Calculator,
            color: 'from-amber-600 to-amber-500',
            fields: []
        }
    ];

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="w-10 h-10 text-brand-green animate-spin" />
            </div>
        );
    }

    if (!financialData) {
        return (
            <div className="text-center py-20 text-muted-foreground bg-muted/30 rounded-2xl border border-border/50">
                لا توجد بيانات مالية مسجلة لهذا الحساب حالياً
            </div>
        );
    }

    return (
        <div className="space-y-4 pb-20">
            {financialData?.updated_at && (
                <div className="bg-brand-green/10 border border-brand-green/20 rounded-xl p-3 px-4 flex justify-between items-center animate-in fade-in slide-in-from-top-2 duration-500 mb-4">
                    <span className="text-brand-green font-bold text-sm">تم مطابقة القيود مع شعبة المالية بتأريخ:</span>
                    <div className="text-gray-900 dark:text-white font-bold text-sm font-mono tracking-wider dir-ltr">
                        {formatDateTime(financialData.updated_at)}
                    </div>
                </div>
            )}

            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="space-y-4"
            >
                {financialGroups.map((group) => (
                    <motion.div key={group.id} variants={itemVariants}>
                        <AccordionSection
                            id={`financial-group-${group.id}`}
                            title={group.title}
                            icon={group.icon as any} // Avoid typing issues with lucide icons
                            color={group.color}
                            isOpen={openSection === group.id}
                            onToggle={() => toggleSection(group.id)}
                        >
                            <div className="table w-full border-separate border-spacing-y-3 p-1">
                                {group.id === 'faq' ? (
                                    <div className="space-y-6 py-2">
                                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3">
                                            <div className="p-2 bg-amber-500 text-white rounded-lg h-fit">
                                                <Calculator className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-amber-900 dark:text-amber-100">احسب راتبك بنفسك</h4>
                                                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 leading-relaxed">
                                                    أداة تفاعلية تتيح لك تقدير راتبك الصافي بناءً على درجتك ومرحلتك الوظيفية والمخصصات التي تستحقها.
                                                </p>
                                            </div>
                                        </div>
                                        <SalaryCalculator />
                                    </div>
                                ) : (
                                    group.fields.map((field) => {
                                        let val;
                                        if (field.key === 'department_name') {
                                            val = departmentInfo.name;
                                        } else if (field.key === 'direct_manager') {
                                            val = departmentInfo.managerName;
                                        } else if (field.key === 'permission_level') {
                                            val = getRoleLabel(user);
                                        } else {
                                            val = field.isProfile ? (user as any)?.[field.key] : (field.isDate ? adminData?.[field.key] : financialData[field.key]);
                                            
                                            // Apply cleaning to organizational fields
                                            if (['dept_text', 'section_text', 'unit_text'].includes(field.key)) {
                                                val = cleanText(val);
                                            }
                                        }

                                        const displayVal = field.isMoney
                                            ? Math.round(Number(val || 0)).toLocaleString()
                                            : field.suffix ? `${val || 0}${field.suffix}` : (val || 'غير محدد');

                                        return (
                                            <div
                                                key={field.key}
                                                className={cn(
                                                    "table-row",
                                                    field.superHighlight && "bg-brand-green/10 rounded-lg shadow-sm"
                                                )}
                                            >
                                                <div className={cn(
                                                    "table-cell align-middle pl-4 w-px whitespace-nowrap",
                                                    field.superHighlight && "rounded-r-lg py-2 pr-2"
                                                )}>
                                                    <span className={cn(
                                                        "text-xs font-bold block",
                                                        field.superHighlight ? "text-brand-green" : "text-muted-foreground"
                                                    )}>
                                                        {field.label}
                                                    </span>
                                                </div>

                                                <div className={cn(
                                                    "table-cell align-middle w-full",
                                                    field.superHighlight && "rounded-l-lg py-2 pl-2"
                                                )}>
                                                    <div className={cn(
                                                        "px-3 py-2 rounded-lg border text-sm font-bold font-mono tracking-wide transition-all text-center",
                                                        field.superHighlight
                                                            ? "bg-brand-green text-white border-brand-green shadow-md"
                                                            : field.highlight
                                                                ? "bg-red-500/10 border-red-500/30 text-red-500 dark:text-red-400"
                                                                : "bg-muted/50 border-input text-foreground hover:bg-muted"
                                                    )}>
                                                        {displayVal}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </AccordionSection>
                    </motion.div>
                ))}

                <motion.div variants={itemVariants} className="mt-6 px-1">
                    <button
                        onClick={() => setShowIban(!showIban)}
                        className="w-full flex items-center justify-center gap-2 bg-brand-yellow-DEFAULT/10 hover:bg-brand-yellow-DEFAULT/20 text-brand-yellow-DEFAULT p-4 rounded-xl transition-all font-bold border border-brand-yellow-DEFAULT/20 shadow-lg hover:shadow-brand-yellow-DEFAULT/10"
                    >
                        {showIban ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        {showIban ? 'اخفاء رمز IBAN المصرفي' : 'اظهار رمز IBAN المصرفي'}
                    </button>

                    <AnimatePresence>
                        {showIban && (
                            <motion.div
                                initial={{ height: 0, opacity: 0, marginTop: 0 }}
                                animate={{ height: 'auto', opacity: 1, marginTop: 12 }}
                                exit={{ height: 0, opacity: 0, marginTop: 0 }}
                                className="bg-card border border-border p-4 rounded-xl font-mono text-center text-lg md:text-2xl tracking-tight md:tracking-widest text-foreground shadow-2xl overflow-hidden relative whitespace-nowrap"
                            >
                                <div className="absolute inset-0 bg-brand-yellow-DEFAULT/5 animate-pulse pointer-events-none" />
                                {user?.iban || financialData.iban || 'لا يوجد رقم IBAN مسجل'}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </motion.div>
        </div>
    );
};

