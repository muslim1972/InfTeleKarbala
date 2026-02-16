import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/layout/Layout";
import { TabSystem } from "../components/features/TabSystem";
import { motion, AnimatePresence } from "framer-motion";
import { YearSlider } from "../components/features/YearSlider";
import { Award, Loader2, Eye, EyeOff, User, Wallet, Scissors, FileText } from "lucide-react";
import { GlassCard } from "../components/ui/GlassCard";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { cn } from "../lib/utils";
import { AccordionSection } from "../components/ui/AccordionSection";
import { RecordList } from "../components/features/RecordList";
import { UserPolls } from "../components/features/UserPolls";
import { formatDateTime } from "../utils/formatDate";

// Interface for Financial Fields
interface FinancialField {
    key: string;
    label: string;
    isMoney?: boolean;
    isDate?: boolean;
    suffix?: string;
    highlight?: boolean;
    superHighlight?: boolean;
}

// Animation Variants
const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
};

export const Dashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'financial' | 'administrative' | 'polls'>('financial');

    // Data State
    const [financialData, setFinancialData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [showIban, setShowIban] = useState(false);

    // UI State for Collapsible Sections
    const [openSection, setOpenSection] = useState<string | null>(null);

    const toggleSection = (section: string) => {
        setOpenSection(prev => {
            const newState = prev === section ? null : section;

            // Auto-scroll when opening
            if (newState) {
                setTimeout(() => {
                    const element = document.getElementById(`financial-group-${section}`);
                    if (element) {
                        const y = element.getBoundingClientRect().top + window.scrollY - 180; // Adjusted offset
                        window.scrollTo({ top: y, behavior: 'smooth' });
                    }
                }, 100);
            }
            return newState;
        });
    };

    // Admin State
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [adminData, setAdminData] = useState<any>(null);
    const [yearlyData, setYearlyData] = useState<any[]>([]);

    // Detailed View State
    const [expandedDetail, setExpandedDetail] = useState<'thanks' | 'committees' | 'penalties' | 'leaves' | null>(null);
    const [detailItems, setDetailItems] = useState<any[]>([]);
    const [detailLoading, setDetailLoading] = useState(false);

    // Leaves Specific State
    const [leavesList, setLeavesList] = useState<any[]>([]);
    const [selectedLeave, setSelectedLeave] = useState<any>(null);







    // Fetch Leaves for selected year
    useEffect(() => {
        const fetchLeaves = async () => {
            if (!user?.id) return;
            const { data } = await supabase
                .from('leaves_details')
                .select('*')
                .eq('user_id', user.id)
                .eq('year', selectedYear)
                .order('start_date', { ascending: false });

            if (data) setLeavesList(data);
        };
        fetchLeaves();
        setSelectedLeave(null); // Reset selection on year change
    }, [selectedYear, user?.id]);

    const handleDetailClick = async (type: 'thanks' | 'committees' | 'penalties' | 'leaves') => {
        if (expandedDetail === type) {
            setExpandedDetail(null);
            return;
        }

        setExpandedDetail(type);
        setDetailLoading(true);
        setDetailItems([]);

        try {
            let tableName = '';
            switch (type) {
                case 'thanks': tableName = 'thanks_details'; break;
                case 'committees': tableName = 'committees_details'; break;
                case 'penalties': tableName = 'penalties_details'; break;
                case 'leaves': tableName = 'leaves_details'; break;
            }

            console.log(`Fetching details for ${type} from ${tableName}`, { userId: user?.id, year: selectedYear });

            // CRITICAL DEBUG: Fetch ALL records for this user to check for year mismatches
            if (type === 'thanks') {
                const { data: allData, error: allError } = await supabase
                    .from(tableName)
                    .select('*')
                    .eq('user_id', user?.id);
                console.log(`DEBUG: ALL ${type} records for user:`, allData);
                if (allError) console.error("DEBUG Error:", allError);
            }

            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .eq('user_id', user?.id)
                .eq('year', selectedYear);

            if (error) {
                console.error("Supabase Error:", error);
                throw error;
            }

            console.log(`Fetched ${data?.length} records for ${type}`);
            setDetailItems(data || []);
        } catch (err) {
            console.error("Error fetching details:", err);
        } finally {
            setDetailLoading(false);
        }
    };

    // Computed Yearly Data
    const currentYearRecord = yearlyData.find(r => r.year === selectedYear) || {};

    // Fetch All Data in Parallel (محسّن للأداء)
    useEffect(() => {
        if (user?.id) {
            const fetchData = async () => {
                setLoading(true);
                console.log("Fetching all data in parallel for user ID:", user.id);

                try {
                    // جلب كل البيانات بالتوازي (أسرع بكثير)
                    const [financialResult, adminResult, yearlyResult] = await Promise.all([
                        supabase
                            .from('financial_records')
                            .select('*')
                            .eq('user_id', user.id)
                            .order('updated_at', { ascending: false })
                            .limit(1)
                            .maybeSingle(),

                        supabase
                            .from('administrative_summary')
                            .select('*')
                            .eq('user_id', user.id)
                            .maybeSingle(),

                        supabase
                            .from('yearly_records')
                            .select('*')
                            .eq('user_id', user.id)
                    ]);

                    // تعيين البيانات مع حساب الإجماليات للعرض
                    if (financialResult.data) {
                        const data = financialResult.data;

                        // حساب الإجماليات من البيانات المستوردة لضمان الاتساق
                        // Total Allowances = Sum of all individual allowances
                        const totalAllowances = (
                            (data.certificate_allowance || 0) +
                            (data.position_allowance || 0) +
                            (data.engineering_allowance || 0) +
                            (data.risk_allowance || 0) +
                            (data.legal_allowance || 0) +
                            (data.additional_50_percent_allowance || 0) +
                            (data.transport_allowance || 0) +
                            (data.marital_allowance || 0) +
                            (data.children_allowance || 0)
                        );

                        // Gross Salary = Net + Total Deductions (reversed from accounting logic)
                        // Or Normal + Total Allowances
                        // We use Net + Deductions as it's the "earned" amount before cuts
                        const totalDeductions = data.total_deductions || 0;
                        const netSalary = data.net_salary || 0;
                        const grossSalary = netSalary + totalDeductions;

                        setFinancialData({
                            ...data,
                            total_allowances: totalAllowances,
                            gross_salary: grossSalary,
                            total_deductions: totalDeductions // Ensure it's set
                        });
                    } else {
                        setFinancialData({
                            user_id: user.id,
                            nominal_salary: 0
                        } as any);
                    }

                    if (adminResult.data) setAdminData(adminResult.data);
                    if (yearlyResult.data) setYearlyData(yearlyResult.data);

                } catch (error) {
                    console.error("Error fetching data:", error);
                } finally {
                    setLoading(false);
                }
            };

            fetchData();
        }
    }, [user?.id]);

    // Reset details when year changes
    useEffect(() => {
        setExpandedDetail(null);
        setDetailItems([]);
    }, [selectedYear]);

    // Scroll to top when switching tabs
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
    }, [activeTab]);



    // Grouped Configuration
    const financialGroups = [
        {
            id: 'basic',
            title: 'المعلومات الاساسية والرواتب',
            icon: User,
            color: 'from-blue-600 to-blue-500',
            fields: [
                { key: 'first_appointment_date', label: 'تاريخ أول مباشرة', isDate: true },
                { key: 'job_title', label: 'العنوان الوظيفي' },
                { key: 'salary_grade', label: 'الدرجة في سلم الرواتب' },
                { key: 'salary_stage', label: 'المرحلة في الدرجة الوظيفية' },
                { key: 'certificate_text', label: 'الشهادة' },
                { key: 'certificate_percentage', label: 'النسبة المستحقة للشهادة', suffix: '%' },
                { key: 'nominal_salary', label: 'الراتب الاسمي', isMoney: true },
                { key: 'gross_salary', label: 'الراتب المستحق قبل الاستقطاع', isMoney: true },
                { key: 'net_salary', label: 'الراتب الصافي مستحق الدفع', isMoney: true, superHighlight: true },
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
        }
    ];

    const headerContent = (
        <div className="flex flex-col gap-2 w-full">
            <TabSystem activeTab={activeTab} onTabChange={setActiveTab} />
            {activeTab !== 'polls' && (
                <YearSlider selectedYear={selectedYear} onYearChange={setSelectedYear} />
            )}
        </div>
    );

    return (
        <Layout headerContent={headerContent} headerTitle="لوحة الموظف" showUserName={true}>
            <div className="max-w-4xl mx-auto px-4 relative pb-20 min-h-[70vh] mt-6">

                {/* Polls Tab */}
                {activeTab === 'polls' ? (
                    <UserPolls />
                ) : activeTab === 'financial' ? (
                    /* Financial Tab */
                    loading ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="w-10 h-10 text-brand-green animate-spin" />
                        </div>
                    ) : financialData ? (
                        <div className="space-y-4 pb-20">
                            {/* Audit Banner for User (Time Only) */}
                            {financialData?.last_modified_at && (
                                <div className="bg-muted/50 border border-border rounded-xl p-3 px-4 flex justify-between items-center animate-in fade-in slide-in-from-top-2 duration-500 mb-4">
                                    <span className="text-muted-foreground text-xs font-bold">آخر تحديث للبيانات المالية:</span>
                                    <div className="text-brand-green font-bold text-sm font-mono tracking-wider dir-ltr">
                                        {formatDateTime(financialData.last_modified_at)}
                                    </div>
                                </div>
                            )}

                            {/* Financial Sections */}
                            <motion.div
                                variants={containerVariants}
                                initial="hidden"
                                animate="show"
                                className="space-y-4"
                            >
                                {financialGroups.map((group) => (
                                    <motion.div key={group.id} variants={itemVariants}>
                                        <AccordionSection
                                            id={group.id}
                                            title={group.title}
                                            icon={group.icon}
                                            color={group.color}
                                            isOpen={openSection === group.id}
                                            onToggle={() => toggleSection(group.id)}
                                        >
                                            <div className="table w-full border-separate border-spacing-y-3 p-1">
                                                {group.fields.map((field) => {
                                                    const val = field.isDate ? adminData?.[field.key] : financialData[field.key];
                                                    const displayVal = field.isMoney
                                                        ? Math.round(Number(val || 0)).toLocaleString()
                                                        : field.suffix ? `${val || 0}${field.suffix}` : (val || 'غير محدد');

                                                    return (
                                                        <div
                                                            key={field.key}
                                                            className={cn(
                                                                "table-row", // Unified Table Layout
                                                                field.superHighlight && "bg-brand-green/10 rounded-lg shadow-sm"
                                                            )}
                                                        >
                                                            {/* Label Column - Smart Auto Width */}
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

                                                            {/* Value Column */}
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
                                        </AccordionSection>
                                    </motion.div>
                                ))}

                                {/* IBAN Section */}
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
                                                className="bg-card border border-border p-4 rounded-xl font-mono text-center text-xl md:text-2xl tracking-[0.2em] text-foreground shadow-2xl overflow-hidden relative"
                                            >
                                                <div className="absolute inset-0 bg-brand-yellow-DEFAULT/5 animate-pulse pointer-events-none" />
                                                {user?.iban || financialData.iban || 'لا يوجد رقم IBAN مسجل'}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            </motion.div>
                        </div>
                    ) : (
                        <div className="text-center py-20 text-muted-foreground bg-muted/30 rounded-2xl border border-border/50">
                            لا توجد بيانات مالية مسجلة لهذا الحساب حالياً
                        </div>
                    )
                ) : (
                    /* Administrative Tab */
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="show"
                        className="space-y-4"
                    >
                        {/* Thanks Books */}
                        <motion.div variants={itemVariants}>
                            <AccordionSection
                                id="thanks"
                                title={`كتب الشكر (${currentYearRecord.thanks_books_count || 0})`}
                                icon={Award}
                                className="border-yellow-500/20"
                                color="from-yellow-600 to-yellow-500" // This should now work with updated AccordionSection
                                isOpen={expandedDetail === 'thanks'}
                                onToggle={() => handleDetailClick('thanks')}
                            >
                                {detailLoading ? (
                                    <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-white/50" /></div>
                                ) : detailItems.length === 0 ? (
                                    <p className="text-center text-amber-600/70 dark:text-amber-400/70 text-sm py-4 font-medium">
                                        تفاصيل كتب الشكر غير متوفرة حالياً
                                    </p>
                                ) : (
                                    <RecordList
                                        data={detailItems}
                                        fields={[
                                            { key: 'book_number', label: 'رقم الكتاب' },
                                            { key: 'reason', label: 'السبب' }
                                        ]}
                                        readOnly={true}
                                    />
                                )}
                            </AccordionSection>
                        </motion.div>

                        {/* Committees */}
                        <motion.div variants={itemVariants}>
                            <AccordionSection
                                id="committees"
                                title={`اللجان (${currentYearRecord.committees_count || 0})`}
                                icon={User}
                                color="from-blue-600 to-blue-500"
                                className="border-blue-500/20"
                                isOpen={expandedDetail === 'committees'}
                                onToggle={() => handleDetailClick('committees')}
                            >
                                {detailLoading ? (
                                    <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-white/50" /></div>
                                ) : detailItems.length === 0 ? (
                                    <p className="text-center text-blue-600/70 dark:text-blue-400/70 text-sm py-4 font-medium">
                                        تفاصيل اللجان غير متوفرة حالياً
                                    </p>
                                ) : (
                                    <RecordList
                                        data={detailItems}
                                        fields={[
                                            { key: 'committee_name', label: 'اسم اللجنة' },
                                            { key: 'role', label: 'الصفة' }
                                        ]}
                                        readOnly={true}
                                    />
                                )}
                            </AccordionSection>
                        </motion.div>

                        {/* Penalties */}
                        <motion.div variants={itemVariants}>
                            <AccordionSection
                                id="penalties"
                                title={`العقوبات (${currentYearRecord.penalties_count || 0})`}
                                icon={FileText}
                                color="from-red-600 to-red-500"
                                className="border-red-500/20"
                                isOpen={expandedDetail === 'penalties'}
                                onToggle={() => handleDetailClick('penalties')}
                            >
                                {detailLoading ? (
                                    <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-white/50" /></div>
                                ) : detailItems.length === 0 ? (
                                    <p className="text-center text-red-600/70 dark:text-red-400/70 text-sm py-4 font-medium">
                                        تفاصيل العقوبات غير متوفرة حالياً
                                    </p>
                                ) : (
                                    <RecordList
                                        data={detailItems}
                                        fields={[
                                            { key: 'penalty_type', label: 'نوع العقوبة' },
                                            { key: 'reason', label: 'السبب' }
                                        ]}
                                        type="penalties"
                                        readOnly={true}
                                    />
                                )}
                            </AccordionSection>
                        </motion.div>

                        {/* Leaves */}
                        <motion.div variants={itemVariants}>
                            <AccordionSection
                                id="leaves"
                                title={`الاجازات (${currentYearRecord.leaves_taken || 0})`}
                                icon={Scissors}
                                color="from-green-600 to-green-500"
                                className="border-green-500/20"
                                isOpen={expandedDetail === 'leaves'}
                                onToggle={() => handleDetailClick('leaves')}
                            >
                                {/* Leaves Custom Content */}
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

                                    {/* Leaves Detail View (Conditional) */}
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
                                            سجل اجازات {selectedYear}
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
                                                    لا توجد اجازات مسجلة في {selectedYear}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </AccordionSection>
                        </motion.div>

                        {/* Spacer for scroll */}
                        <div className="h-20"></div>
                    </motion.div>
                )}
                {/* User Chat FAB */}
                <motion.button
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => navigate('/chat', { state: { adminViewMode: 'user' } })}
                    className="fixed bottom-24 left-6 z-50 w-16 h-16 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 group p-0 overflow-hidden border-2 border-white/20"
                >
                    <img
                        src="/images/conv-icon.png"
                        alt="المحادثات"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            // Fallback if image missing
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement?.classList.add('bg-gradient-to-r', 'from-violet-600', 'to-indigo-600', 'flex', 'items-center', 'justify-center');
                            const icon = document.createElement('div');
                            icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-circle w-8 h-8 text-white"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>';
                            e.currentTarget.parentElement?.appendChild(icon);
                        }}
                    />
                    <span className="sr-only">المحادثات</span>

                    {/* Ripple Effect Grid */}
                    <div className="absolute inset-0 rounded-full border border-white/20 animate-ping opacity-20" />
                </motion.button>
            </div>
        </Layout>
    );
};
