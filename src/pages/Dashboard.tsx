import { useState, useEffect } from "react";
import { Layout } from "../components/layout/Layout";
import { TabSystem } from "../components/features/TabSystem";
import { motion, AnimatePresence } from "framer-motion";
import { YearSlider } from "../components/features/YearSlider";
import { Award, Loader2, Eye, EyeOff, ChevronDown, User, Wallet, Scissors } from "lucide-react";
import { GlassCard } from "../components/ui/GlassCard";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { cn } from "../lib/utils";

// Interface for Financial Fields
interface FinancialField {
    key: string;
    label: string;
    isMoney?: boolean;
    suffix?: string;
    highlight?: boolean;
    superHighlight?: boolean;
}

export const Dashboard = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'financial' | 'administrative'>('financial');

    // Data State
    const [financialData, setFinancialData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [showIban, setShowIban] = useState(false);

    // UI State for Collapsible Sections
    const [expandedSections, setExpandedSections] = useState({
        basic: false,
        allowances: false,
        deductions: false
    });

    // Admin State
    const [showYearView, setShowYearView] = useState(false);
    const [selectedYear, setSelectedYear] = useState(2024);

    // Fetch Financial Data
    useEffect(() => {
        if (user?.id) {
            const fetchData = async () => {
                setLoading(true);
                const { data } = await supabase
                    .from('financial_records')
                    .select('*')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (data) setFinancialData(data);
                setLoading(false);
            };

            fetchData();
        }
    }, [user?.id]);

    const toggleSection = (section: keyof typeof expandedSections) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    // Grouped Configuration
    const financialGroups = [
        {
            id: 'basic',
            title: 'المعلومات الاساسية والرواتب',
            icon: User,
            color: 'from-blue-600 to-blue-500',
            fields: [
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

    return (
        <Layout>
            <TabSystem activeTab={activeTab} onTabChange={setActiveTab} />

            <div className="relative pb-20">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, x: activeTab === 'financial' ? -20 : 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: activeTab === 'financial' ? 20 : -20 }}
                        transition={{ duration: 0.3 }}
                    >
                        {activeTab === 'financial' ? (
                            loading ? (
                                <div className="flex justify-center py-20">
                                    <Loader2 className="w-10 h-10 text-brand-green animate-spin" />
                                </div>
                            ) : financialData ? (
                                <div className="space-y-4">
                                    {/* Scrollable Container Wrapper */}
                                    <div className="max-h-[70vh] overflow-y-auto pr-1 pl-1 -mr-1 custom-scrollbar space-y-4 pb-20">

                                        {financialGroups.map((group) => (
                                            <div key={group.id} className="rounded-2xl overflow-hidden shadow-lg border border-white/5">
                                                {/* Header Button */}
                                                <button
                                                    onClick={() => toggleSection(group.id as any)}
                                                    className={cn(
                                                        "w-full p-4 flex items-center justify-between text-white transition-all",
                                                        "bg-gradient-to-r hover:brightness-110",
                                                        group.color
                                                    )}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="bg-white/20 p-2 rounded-lg">
                                                            <group.icon className="w-5 h-5" />
                                                        </div>
                                                        <span className="font-bold text-lg">{group.title}</span>
                                                    </div>
                                                    <ChevronDown className={cn(
                                                        "w-5 h-5 transition-transform duration-300",
                                                        expandedSections[group.id as keyof typeof expandedSections] ? "rotate-180" : ""
                                                    )} />
                                                </button>

                                                {/* Content */}
                                                <AnimatePresence>
                                                    {expandedSections[group.id as keyof typeof expandedSections] && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                                                            className="bg-black/20"
                                                        >
                                                            <div className="p-3 space-y-2">
                                                                {group.fields.map((field) => {
                                                                    const val = financialData[field.key];
                                                                    const displayVal = field.isMoney
                                                                        ? Number(val || 0).toLocaleString()
                                                                        : field.suffix ? `${val || 0}${field.suffix}` : (val || '-');

                                                                    return (
                                                                        <div
                                                                            key={field.key}
                                                                            className={cn(
                                                                                "flex justify-between items-center p-4 rounded-xl border transition-colors",
                                                                                field.superHighlight ? "bg-brand-green/20 border-brand-green text-white" :
                                                                                    field.highlight ? "bg-red-500/10 border-red-500/20 text-white" :
                                                                                        "bg-white/5 border-white/5 text-white/80 hover:bg-white/10"
                                                                            )}
                                                                        >
                                                                            <span className="font-medium text-sm md:text-base">{field.label}</span>
                                                                            <span className={cn(
                                                                                "font-bold font-mono tracking-wide",
                                                                                field.superHighlight ? "text-xl" : "text-base"
                                                                            )}>
                                                                                {displayVal}
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
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
                                                        className="bg-[#0f172a] border border-white/20 p-4 rounded-xl font-mono text-center text-xl md:text-2xl tracking-[0.2em] text-white shadow-2xl overflow-hidden"
                                                    >
                                                        {financialData.iban || 'لا يوجد رقم IBAN مسجل'}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-20 text-white/50 bg-white/5 rounded-2xl border border-white/10">
                                    لا توجد بيانات مالية مسجلة لهذا الحساب حالياً
                                </div>
                            )
                        ) : (
                            // Administrative Tab
                            <div className="space-y-6">

                                {/* Years Toggle Button */}
                                <button
                                    onClick={() => setShowYearView(!showYearView)}
                                    className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white p-4 rounded-xl font-bold shadow-lg flex items-center justify-between hover:from-blue-500 hover:to-blue-400 transition-all"
                                >
                                    <span>كتب الشكر والتقدير {showYearView ? '(إخفاء)' : ''}</span>
                                    <Award className="w-5 h-5" />
                                </button>

                                <AnimatePresence>
                                    {showYearView && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <YearSlider selectedYear={selectedYear} onYearChange={setSelectedYear} />

                                            <div className="grid grid-cols-1 gap-3 mt-4">
                                                <div className="bg-white/5 p-4 rounded-xl flex justify-between items-center">
                                                    <span className="text-white/70">كتب الشكر</span>
                                                    <span className="text-white font-bold text-xl">5</span>
                                                </div>
                                                <div className="bg-white/5 p-4 rounded-xl flex justify-between items-center">
                                                    <span className="text-white/70">اللجان</span>
                                                    <span className="text-white font-bold text-xl">12</span>
                                                </div>
                                                <div className="bg-white/5 p-4 rounded-xl flex justify-between items-center">
                                                    <span className="text-white/70">العقوبات</span>
                                                    <span className="text-white font-bold text-xl text-red-400">0</span>
                                                </div>
                                                <div className="bg-white/5 p-4 rounded-xl flex justify-between items-center">
                                                    <span className="text-white/70">الاجازات (في هذه السنة)</span>
                                                    <span className="text-white font-bold text-xl">3</span>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Leaves Balance Section */}
                                <div className="space-y-3 pt-4">
                                    <h3 className="text-white font-bold border-r-4 border-brand-green pr-3">رصيد الاجازات</h3>

                                    <GlassCard className="space-y-4 p-5">
                                        <div className="flex justify-between border-b border-white/10 pb-3">
                                            <span className="text-white/70">رصيد الاجازات المتبقي</span>
                                            <span className="text-white font-bold">45 يوم</span>
                                        </div>
                                        <div className="flex justify-between border-b border-white/10 pb-3">
                                            <span className="text-white/70">الاجازات المحتسبة من الرصيد</span>
                                            <span className="text-white font-bold">12 يوم</span>
                                        </div>
                                        <div className="flex justify-between border-b border-white/10 pb-3">
                                            <span className="text-white/70">الاجازات بدون راتب</span>
                                            <span className="text-white font-bold">0</span>
                                        </div>

                                        <div className="pt-2">
                                            <p className="text-white/90 font-bold mb-2 text-sm">الاجازات حسب قانون الخمس سنوات</p>
                                            <div className="grid grid-cols-2 gap-4 bg-white/5 p-3 rounded-lg">
                                                <div>
                                                    <p className="text-white/40 text-xs mb-1">تاريخ الانفكاك</p>
                                                    <p className="text-white font-mono text-sm">--/--/----</p>
                                                </div>
                                                <div>
                                                    <p className="text-white/40 text-xs mb-1">تاريخ المباشرة</p>
                                                    <p className="text-white font-mono text-sm">--/--/----</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex justify-between pt-2">
                                            <span className="text-white/70">الاجازات المرضية</span>
                                            <span className="text-white font-bold">5 يوم</span>
                                        </div>

                                    </GlassCard>
                                </div>

                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </Layout>
    );
};
