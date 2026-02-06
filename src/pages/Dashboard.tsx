import { useState, useEffect } from "react";
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

export const Dashboard = () => {
    const { user } = useAuth();
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

    // Lifetime Counters & Iraqi Logic
    const [lifetimeUsage, setLifetimeUsage] = useState({ regular: 0, sick: 0 });

    const calculateBalances = () => {
        // استخدام resumption_date (تاريخ المباشرة الجديد) إن وجد، وإلا first_appointment_date
        const appointmentDateStr = adminData?.resumption_date || adminData?.first_appointment_date;
        const appointmentDate = appointmentDateStr ? new Date(appointmentDateStr) : null;

        let totalSickBalance = 365;
        let totalRegularBalance = 0;

        // Sick Balance (Lifetime 365)
        const remainingSick = totalSickBalance - (lifetimeUsage.sick || 0);

        // Regular Balance - المعادلة الصحيحة
        if (appointmentDate) {
            const now = new Date();

            // حساب السنوات الميلادية الكاملة (من سنة التعيين+1 إلى السنة الحالية-1)
            const completeYears = now.getFullYear() - appointmentDate.getFullYear() - 1;

            // حساب أشهر السنة الحالية
            const currentYearMonths = now.getMonth() + 1; // +1 لأن getMonth() يبدأ من 0

            // المعادلة: (السنوات الكاملة × 12 × 3) + (أشهر السنة الحالية × 3)
            totalRegularBalance = (completeYears * 12 * 3) + (currentYearMonths * 3);
        }

        const remainingRegular = totalRegularBalance - (lifetimeUsage.regular || 0);

        return {
            sick: remainingSick,
            regular: remainingRegular < 0 ? 0 : remainingRegular,
            total_earned_regular: totalRegularBalance
        };
    };

    const balances = calculateBalances();

    // Fetch Lifetime Usage
    useEffect(() => {
        const fetchLifetime = async () => {
            if (!user?.id) return;
            const { data } = await supabase.rpc('get_lifetime_leaves_usage', { target_user_id: user.id });
            if (data) {
                setLifetimeUsage({
                    regular: data.total_regular_days || 0,
                    sick: data.total_sick_days || 0
                });
            }
        };
        fetchLifetime();
    }, [user?.id, leavesList]); // Refresh when leaves change

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

            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .eq('user_id', user?.id)
                .eq('year', selectedYear);

            if (error) throw error;
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

                    // تعيين البيانات
                    if (financialResult.data) {
                        setFinancialData(financialResult.data);
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
                                        {new Date(financialData.last_modified_at).toLocaleDateString('en-GB')} {new Date(financialData.last_modified_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                    </div>
                                </div>
                            )}

                            {/* Financial Sections */}
                            {financialGroups.map((group) => (
                                <AccordionSection
                                    key={group.id}
                                    id={group.id}
                                    title={group.title}
                                    icon={group.icon}
                                    color={group.color}
                                    isOpen={openSection === group.id}
                                    onToggle={() => toggleSection(group.id)}
                                >
                                    <div className="space-y-3 p-1">
                                        {group.fields.map((field) => {
                                            const val = field.isDate ? adminData?.[field.key] : financialData[field.key];
                                            const displayVal = field.isMoney
                                                ? Math.round(Number(val || 0)).toLocaleString()
                                                : field.suffix ? `${val || 0}${field.suffix}` : (val || 'غير محدد');

                                            return (
                                                <div
                                                    key={field.key}
                                                    className={cn(
                                                        "grid grid-cols-[132px_1fr] items-center gap-2", // Unified Grid Layout
                                                        field.superHighlight && "bg-brand-green/10 rounded-lg -mx-2 px-2 py-1"
                                                    )}
                                                >
                                                    {/* Label Column */}
                                                    <div className="flex justify-start pl-2">
                                                        <span className={cn(
                                                            "text-xs font-bold block whitespace-nowrap text-right w-full",
                                                            field.superHighlight ? "text-brand-green" : "text-muted-foreground"
                                                        )}>
                                                            {field.label}
                                                        </span>
                                                    </div>

                                                    {/* Value Column */}
                                                    <div className={cn(
                                                        "flex-1 px-3 py-2 rounded-lg border text-sm font-bold font-mono tracking-wide transition-all",
                                                        field.superHighlight
                                                            ? "bg-brand-green text-white border-brand-green shadow-lg shadow-brand-green/20 text-center text-lg"
                                                            : field.highlight
                                                                ? "bg-red-500/10 border-red-500/30 text-red-500 dark:text-red-400"
                                                                : "bg-muted/50 border-input text-foreground hover:bg-muted"
                                                    )}>
                                                        {displayVal}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </AccordionSection>
                            ))}

                            {/* IBAN Section */}
                            <div className="mt-6 px-1">
                                <button
                                    onClick={() => setShowIban(!showIban)}
                                    className="w-full flex items-center justify-center gap-2 bg-brand-yellow-DEFAULT/10 hover:bg-brand-yellow-DEFAULT/20 text-brand-yellow-DEFAULT p-4 rounded-xl transition-all font-bold border border-brand-yellow-DEFAULT/20"
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
                                            className="bg-card border border-border p-4 rounded-xl font-mono text-center text-xl md:text-2xl tracking-[0.2em] text-foreground shadow-2xl overflow-hidden"
                                        >
                                            {user?.iban || financialData.iban || 'لا يوجد رقم IBAN مسجل'}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-20 text-muted-foreground bg-muted/30 rounded-2xl border border-border/50">
                            لا توجد بيانات مالية مسجلة لهذا الحساب حالياً
                        </div>
                    )
                ) : (
                    /* Administrative Tab */
                    <div className="space-y-4">
                        {/* Thanks Books */}
                        <AccordionSection
                            id="thanks"
                            title={`كتب الشكر (${currentYearRecord.thanks_books_count || 0})`}
                            icon={Award}
                            className="border-yellow-500/20"
                            color="from-yellow-600 to-yellow-500"
                            isOpen={expandedDetail === 'thanks'}
                            onToggle={() => handleDetailClick('thanks')}
                        >
                            {detailLoading ? (
                                <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-white/50" /></div>
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

                        {/* Committees */}
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

                        {/* Penalties */}
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

                        {/* Leaves */}
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
                                <h3 className="text-foreground font-bold border-r-4 border-brand-green pr-3">رصيد الاجازات</h3>

                                <GlassCard className="p-5 relative overflow-hidden transition-all duration-300">
                                    <AnimatePresence mode="wait">
                                        {selectedLeave ? (
                                            <motion.div
                                                key="detail"
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 20 }}
                                                className="space-y-4"
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h4 className="text-brand-green font-bold text-lg mb-1">{selectedLeave.leave_type}</h4>
                                                        <p className="text-white/60 text-sm">تفاصيل الاجازة المسجلة</p>
                                                    </div>
                                                    <button
                                                        onClick={() => setSelectedLeave(null)}
                                                        className="bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded-lg text-xs transition-colors"
                                                    >
                                                        عودة للملخص
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
                                            </motion.div>
                                        ) : (
                                            <motion.div
                                                key="summary"
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                className="space-y-3"
                                            >
                                                <div className="flex justify-between border-b border-border pb-2 mb-3 bg-brand-green/5 p-3 rounded-lg">
                                                    <span className="text-foreground font-bold text-sm">إجمالي الرصيد المستحق</span>
                                                    <span className="text-foreground font-bold text-lg text-brand-yellow">{balances.total_earned_regular} يوم</span>
                                                </div>
                                                <div className="flex justify-between border-b border-border pb-2">
                                                    <span className="text-muted-foreground text-sm">الرصيد الاعتيادي المتبقي</span>
                                                    <span className="text-brand-green font-bold">{balances.regular} يوم</span>
                                                </div>
                                                <div className="flex justify-between border-b border-border pb-2">
                                                    <span className="text-muted-foreground text-sm">الرصيد المرضي المتبقي</span>
                                                    <span className="font-bold text-blue-500">{balances.sick} يوم</span>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3 pt-1">
                                                    <div className="bg-muted/50 p-2 rounded text-center border border-border">
                                                        <p className="text-muted-foreground text-xs">المستخدم (اعتيادية)</p>
                                                        <p className="text-foreground font-bold">{lifetimeUsage.regular} يوم</p>
                                                    </div>
                                                    <div className="bg-muted/50 p-2 rounded text-center border border-border">
                                                        <p className="text-muted-foreground text-xs">المستخدم (مرضية)</p>
                                                        <p className="text-foreground font-bold">{lifetimeUsage.sick} يوم</p>
                                                    </div>
                                                </div>

                                                <div className="text-center pt-2">
                                                    <span className="text-muted-foreground text-[10px]">
                                                        تاريخ المباشرة: {adminData?.first_appointment_date || 'غير محدد'}
                                                    </span>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </GlassCard>

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

                        {/* Spacer for scroll */}
                        <div className="h-20"></div>
                    </div>
                )}
            </div>
        </Layout>
    );
};
