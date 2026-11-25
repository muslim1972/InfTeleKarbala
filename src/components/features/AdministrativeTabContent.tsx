import { motion, AnimatePresence } from "framer-motion";
import { AdministrativeMovementsCard } from "./AdministrativeMovementsCard";
import { GlassCard } from "../ui/GlassCard";
import { cn } from "../../lib/utils";
import { getRoleLabel } from "../../utils/formatRoles";
import { cleanText } from "../../utils/profileUtils";

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

interface BasicInfoField {
    key: string;
    label: string;
    isMoney?: boolean;
    isDate?: boolean;
    suffix?: string;
    highlight?: boolean;
    superHighlight?: boolean;
    isProfile?: boolean;
}

interface AdministrativeTabContentProps {
    currentYearRecord: any;
    expandedDetail?: 'thanks' | 'committees' | 'penalties' | 'leaves' | null;
    handleDetailClick?: (type: 'thanks' | 'committees' | 'penalties' | 'leaves') => void;
    detailLoading?: boolean;
    detailItems?: any[];
    financialData: any;
    selectedYear?: number;
    leavesList: any[];
    selectedLeave: any;
    setSelectedLeave: (leave: any | null) => void;
    user: any;
    departmentInfo: { name: string; managerName: string; sectionName?: string; deptName?: string };
    openSection: string | null;
    toggleSection: (section: string) => void;
    activeSubTab?: 'basic' | 'movements' | 'leaves';
}

const basicInfoFields: BasicInfoField[] = [
    { key: 'permission_level', label: 'مستوى الصلاحية', superHighlight: true },
    { key: 'job_number', label: 'الرقم الوظيفي', isProfile: true, superHighlight: true },
    { key: 'full_name', label: 'الاسم الكامل', isProfile: true },
    { key: 'mother_name', label: 'اسم الأم', isProfile: true },
    { key: 'gender_display', label: 'الجنس', isProfile: true },
    { key: 'birth_date', label: 'تاريخ الولادة', isProfile: true, isDate: true },
    { key: 'phone_number', label: 'رقم الهاتف', isProfile: true },
    { key: 'job_title', label: 'العنوان الوظيفي' },
    { key: 'position_title', label: 'المنصب الإداري', isProfile: true },
    { key: 'general_specialization', label: 'الاختصاص العام', isProfile: true },
    { key: 'specialization', label: 'التخصص (PROF)', isProfile: true },
    { key: 'certificate_text', label: 'الشهادة' },
    { key: 'graduation_year', label: 'سنة التخرج', isProfile: true },
    { key: 'appointment_date', label: 'تاريخ التعيين', isProfile: true, isDate: true },
    { key: 'work_nature', label: 'طبيعة العمل', isProfile: true },
    { key: 'salary_grade', label: 'الدرجة في سلم الرواتب' },
    { key: 'salary_stage', label: 'المرحلة في الدرجة الوظيفية' },
    { key: 'dept_text', label: 'القسم', isProfile: true },
    { key: 'section_text', label: 'الشعبة', isProfile: true },
    { key: 'unit_text', label: 'الوحدة', isProfile: true },
    { key: 'department_name', label: 'مكان العمل' },
    { key: 'direct_manager', label: 'المسؤول المباشر' },
    { key: 'leave_date', label: 'تاريخ الترك', isProfile: true },
    { key: 'reinstatement_date', label: 'تاريخ الإعادة', isProfile: true },
    { key: 'reinstatement_type', label: 'نوع الإعادة', isProfile: true },
];

export const AdministrativeTabContent = ({
    currentYearRecord,
    financialData,
    leavesList,
    selectedLeave,
    setSelectedLeave,
    user,
    departmentInfo,
    activeSubTab = 'basic'
}: AdministrativeTabContentProps) => {
    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-4"
        >
            {/* Basic Info Section - مباشر بدون أكورديون */}
            {activeSubTab === 'basic' && (
            <motion.div variants={itemVariants}>
                <div className="p-3.5 sm:p-5 rounded-2xl border border-blue-500/25 bg-white/85 dark:bg-slate-900/70 backdrop-blur-md shadow-sm">
                    <div className="table w-full border-separate border-spacing-y-3 p-1">
                        {basicInfoFields.map((field) => {
                            let val: any;
                            if (field.key === 'department_name') {
                                val = departmentInfo.name;
                            } else if (field.key === 'direct_manager') {
                                val = departmentInfo.managerName;
                            } else if (field.key === 'permission_level') {
                                val = getRoleLabel(user);
                            } else if (field.key === 'job_number') {
                                val = user?.job_number || user?.username;
                            } else if (field.key === 'gender_display') {
                                const g = (user as any)?.gender;
                                val = g === 'male' || g === 'ذكر' ? 'ذكر' : g === 'female' || g === 'أنثى' ? 'أنثى' : g;
                            } else if (field.key === 'birth_date') {
                                const bd = (user as any)?.birth_date;
                                val = bd ? String(bd).split('T')[0] : '';
                            } else if (field.key === 'section_text') {
                                val = departmentInfo.sectionName || cleanText((user as any)?.section_text);
                            } else if (field.key === 'dept_text') {
                                val = departmentInfo.deptName || cleanText((user as any)?.dept_text);
                            } else {
                                val = field.isProfile ? (user as any)?.[field.key] : financialData?.[field.key];
                                if (['unit_text'].includes(field.key)) {
                                    val = cleanText(val);
                                }
                            }

                            // فلترة ديناميكية: إخفاء الحقول غير الأساسية إذا كانت فارغة لمنع ازدحام الواجهة
                            const ESSENTIAL_KEYS = ['permission_level', 'job_number', 'full_name', 'dept_text', 'job_title', 'salary_grade', 'salary_stage', 'certificate_text'];
                            const hasValue = val !== null && val !== undefined && String(val).trim() !== '' && String(val).trim() !== '0';
                            if (!ESSENTIAL_KEYS.includes(field.key) && !hasValue) {
                                return null;
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
                        })}
                    </div>
                </div>
            </motion.div>
            )}

            {/* بطاقة الحركات المدمجة (كتب الشكر / اللجان / العقوبات) */}
            {activeSubTab === 'movements' && (
            <motion.div variants={itemVariants}>
                <div className="p-3.5 sm:p-5 rounded-2xl border border-purple-500/25 bg-white/85 dark:bg-slate-900/70 backdrop-blur-md shadow-sm">
                    <AdministrativeMovementsCard userId={user?.id} />
                </div>
            </motion.div>
            )}

            {/* Leaves */}
            {activeSubTab === 'leaves' && (
            <motion.div variants={itemVariants}>
                <div className="p-3.5 sm:p-5 rounded-2xl border border-emerald-500/25 bg-white/85 dark:bg-slate-900/70 backdrop-blur-md shadow-sm">
                    <div className="space-y-4">
                        <h3 className="text-foreground font-bold border-r-4 border-brand-green pr-3">
                            رصيد الاجازات {financialData?.leaves_balance_expiry_date ? `حتى نهاية ${financialData.leaves_balance_expiry_date}` : ''}
                        </h3>

                        {/* Balance Summary Card */}
                        <div className="bg-white dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 shadow-sm">
                            <div className="bg-zinc-100 dark:bg-zinc-900/50 rounded-lg p-3 mb-4 text-center">
                                <p className="text-sm text-zinc-500 mb-1 font-bold">إجمالي الرصيد المستحق</p>
                                <p className="text-2xl font-black text-zinc-900 dark:text-white">
                                    {financialData?.remaining_leaves_balance || 0} يوم
                                </p>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-sm border-b border-zinc-100 dark:border-zinc-700 pb-2">
                                    <span className="text-zinc-500">الرصيد الاعتيادي المتبقي</span>
                                    <span className="font-bold text-green-600">{financialData?.remaining_leaves_balance || 0} يوم</span>
                                </div>
                                <div className="flex justify-between items-center text-sm border-b border-zinc-100 dark:border-zinc-700 pb-2">
                                    <span className="text-zinc-500">الرصيد المرضي المتبقي</span>
                                    <span className="font-bold text-blue-600">365 يوم</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mt-4">
                                <div className="bg-zinc-50 dark:bg-zinc-900/30 rounded border border-zinc-200 dark:border-zinc-700 p-2 text-center">
                                    <p className="text-xs text-zinc-400 mb-1">المستخدم الكلي (اعتيادية)</p>
                                    <p className="font-bold text-zinc-700 dark:text-zinc-300">
                                        {currentYearRecord.leaves_taken || 0} يوم
                                    </p>
                                </div>
                                <div className="bg-zinc-50 dark:bg-zinc-900/30 rounded border border-zinc-200 dark:border-zinc-700 p-2 text-center">
                                    <p className="text-xs text-zinc-400 mb-1">المستخدم الكلي (مرضية)</p>
                                    <p className="font-bold text-zinc-700 dark:text-zinc-300">
                                        {currentYearRecord.sick_leaves || 0} يوم
                                    </p>
                                </div>
                            </div>

                            <p className="text-[10px] text-center text-zinc-400 mt-3 pt-2 border-t border-dashed border-zinc-200 dark:border-zinc-700">
                                تاريخ المباشرة: غير محدد
                            </p>
                        </div>

                        {/* Leaves Detail View */}
                        <AnimatePresence>
                            {selectedLeave && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                                    animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                                    className="overflow-hidden"
                                >
                                    <GlassCard className="p-5 relative transition-all duration-300">
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h4 className="text-brand-green font-bold text-lg mb-1">{selectedLeave.leave_type}</h4>
                                                    <p className="text-white/60 text-sm">تفاصيل الاجازة المسجلة</p>
                                                </div>
                                                <button
                                                    onClick={() => setSelectedLeave(null)}
                                                    className="bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded-lg text-xs transition-colors"
                                                >
                                                    إغلاق
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 bg-black/20 p-4 rounded-xl border border-white/5">
                                                <div>
                                                    <p className="text-white/40 text-xs mb-1">تاريخ الانفكاك</p>
                                                    <p className="text-white font-mono font-bold">{selectedLeave.start_date}</p>
                                                </div>
                                                <div>
                                                    <p className="text-white/40 text-xs mb-1">المدة</p>
                                                    <p className="text-brand-green font-bold">{selectedLeave.duration} يوم</p>
                                                </div>
                                                {selectedLeave.end_date && (
                                                    <div className="col-span-2 border-t border-white/5 pt-2 mt-2">
                                                        <p className="text-white/40 text-xs mb-1">تاريخ المباشرة</p>
                                                        <p className="text-white font-mono">{selectedLeave.end_date}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </GlassCard>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                            <h4 className="text-xs font-bold text-muted-foreground px-4 py-3 bg-muted/50 border-b border-border">
                                سجل الإجازات
                            </h4>
                            <div className="max-h-48 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                                {leavesList.length > 0 ? (
                                    leavesList.map((leave, idx) => (
                                        <button
                                            key={leave.id || idx}
                                            onClick={() => setSelectedLeave(leave)}
                                            className={cn(
                                                "w-full flex justify-between items-center p-3 rounded-lg border transition-all text-right",
                                                selectedLeave?.id === leave.id
                                                    ? "bg-brand-green/10 border-brand-green/50 ring-1 ring-brand-green/20"
                                                    : "bg-muted/20 border-transparent hover:bg-muted/50"
                                            )}
                                        >
                                            <div>
                                                <p className={cn("font-bold text-sm", selectedLeave?.id === leave.id ? "text-brand-green" : "text-foreground")}>
                                                    {leave.leave_type}
                                                </p>
                                                <p className="text-muted-foreground text-xs mt-0.5">{leave.start_date}</p>
                                            </div>
                                            <div className="bg-background px-2 py-1 rounded text-xs text-foreground/70 font-mono border border-border">
                                                {leave.duration} يوم
                                            </div>
                                        </button>
                                    ))
                                ) : (
                                    <div className="text-center py-8 text-muted-foreground text-sm">
                                        لا توجد اجازات مسجلة
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
            )}
        </motion.div>
    );
};
