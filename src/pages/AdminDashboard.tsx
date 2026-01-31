
import { useState, useRef, useEffect } from "react";
import { Layout } from "../components/layout/Layout";
import { GlassCard } from "../components/ui/GlassCard";
import { UserPlus, Settings, Save, Search, User, Check, Wallet, Scissors, ChevronDown, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { toast } from "react-hot-toast";
import { cn } from "../lib/utils";



export const AdminDashboard = () => {
    const [activeTab, setActiveTab] = useState<'admin_add' | 'admin_manage'>('admin_add');
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        username: "",
        password: "",
        full_name: "",
        job_number: "",
        role: "user"
    });

    // Manage Employees State
    const [searchJobNumber, setSearchJobNumber] = useState("");
    const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
    const [financialData, setFinancialData] = useState<any>(null);
    const [expandedSections, setExpandedSections] = useState({
        main_info: false, // Renamed from collision with 'basic'
        basic: false,
        allowances: false,
        deductions: false,
        admin_summary: false,
        yearly_records: false
    });

    // New Data States
    const [adminData, setAdminData] = useState<any>(null);
    const [yearlyData, setYearlyData] = useState<any[]>([]); // Array of yearly records

    const detailsRef = useRef<HTMLDivElement>(null);

    const handleSearch = async () => {
        const trimmedSearch = searchJobNumber.trim();
        if (!trimmedSearch) return;
        setLoading(true);
        console.log("Searching for job number:", trimmedSearch);
        try {
            // جلب الموظف أولاً
            const { data: userData, error: userError } = await supabase
                .from('app_users')
                .select('*')
                .eq('job_number', trimmedSearch)
                .maybeSingle();

            if (userError) {
                console.error("User search error:", userError);
                throw userError;
            }

            console.log("User data found:", userData);

            if (!userData) {
                toast.error("الموظف غير موجود برقم: " + trimmedSearch);
                setSelectedEmployee(null);
                setFinancialData(null);
                return;
            }

            setSelectedEmployee(userData);

            // جلب سجلاته المالية
            const { data: finData, error: finError } = await supabase
                .from('financial_records')
                .select('*')
                .eq('user_id', userData.id)
                .maybeSingle();

            if (finError) throw finError;

            // إذا وجدنا الموظف ولم نجد بياناته المالية، ننشئ سجل افتراضي محلي ليتمكن المدير من تعبئته
            const emptyFinancial = {
                user_id: userData.id,
                nominal_salary: 0,
                job_title: "",
                salary_grade: "",
                salary_stage: "",
                certificate_text: "",
                certificate_percentage: 0,
                certificate_allowance: 0,
                engineering_allowance: 0,
                legal_allowance: 0,
                transport_allowance: 0,
                marital_allowance: 0,
                children_allowance: 0,
                position_allowance: 0,
                risk_allowance: 0,
                additional_50_percent_allowance: 0,
                tax_deduction_status: "",
                tax_deduction_amount: 0,
                loan_deduction: 0,
                execution_deduction: 0,
                retirement_deduction: 0,
                school_stamp_deduction: 0,
                social_security_deduction: 0,
                other_deductions: 0
            };

            if (!finData) {
                setFinancialData(emptyFinancial);
                toast.success("الموظف موجود (يرجى إدخال بيانات الراتب الجديدة)");
            } else {
                setFinancialData({ ...emptyFinancial, ...finData });
            }

            // 3. Fetch Administrative Summary
            const { data: admData, error: admError } = await supabase
                .from('administrative_summary')
                .select('*')
                .eq('user_id', userData.id)
                .maybeSingle();

            if (!admError) {
                setAdminData(admData || {
                    user_id: userData.id,
                    remaining_leave_balance: 0,
                    five_year_law_leaves: 0,
                    disengagement_date: null,
                    resumption_date: null
                });
            }

            // 4. Fetch Yearly Records (Last 5 years for simplicity or all)
            const { data: yData, error: yError } = await supabase
                .from('yearly_records')
                .select('*')
                .eq('user_id', userData.id)
                .order('year', { ascending: false });

            if (!yError) {
                // If no records, maybe initialize current year? letting UI handle it.
                setYearlyData(yData || []);
            }

            toast.success("تم جلب بيانات الموظف بنجاح");
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    // Auto-calculate allowances
    useEffect(() => {
        if (!financialData) return;

        let shouldUpdate = false;
        const newFinancialData = { ...financialData };

        // 1. Calculate Certificate Allowance
        const nominalSalary = Number(financialData.nominal_salary || 0);
        const certPercentage = Number(financialData.certificate_percentage || 0);
        const calcCertAllowance = (certPercentage / 100) * nominalSalary;

        if (Number(financialData.certificate_allowance) !== calcCertAllowance) {
            newFinancialData.certificate_allowance = calcCertAllowance;
            shouldUpdate = true;
        }

        // 2. Calculate Engineering Allowance
        const engineeringTitles = ['مهندس', 'ر. مهندسين', 'ر. مهندسين اقدم', 'ر. مهندسين اقدم اول'];
        let calcEngAllowance = 0;
        if (engineeringTitles.includes(financialData.job_title)) {
            calcEngAllowance = nominalSalary * 0.35; // 35% fixed
        }

        if (Number(financialData.engineering_allowance) !== calcEngAllowance) {
            newFinancialData.engineering_allowance = calcEngAllowance;
            shouldUpdate = true;
        }

        // 3. Calculate Deductions
        // Tax Deduction: 3.5% of Nominal Salary, formatted to max 3 decimal places
        let calcTaxDeduction = nominalSalary * 0.035;
        // Check if it has decimals
        if (!Number.isInteger(calcTaxDeduction)) {
            // Check if it has more than 3 decimal places
            const str = calcTaxDeduction.toString();
            if (str.includes('.') && str.split('.')[1].length > 3) {
                // Truncate to 3 decimal places without rounding up
                calcTaxDeduction = Math.floor(calcTaxDeduction * 1000) / 1000;
            }
        }

        if (Number(financialData.tax_deduction_amount) !== calcTaxDeduction) {
            newFinancialData.tax_deduction_amount = calcTaxDeduction;
            shouldUpdate = true;
        }

        // Retirement Deduction: 10% of Nominal Salary
        const calcRetirement = nominalSalary * 0.10;
        if (Number(financialData.retirement_deduction) !== calcRetirement) {
            newFinancialData.retirement_deduction = calcRetirement;
            shouldUpdate = true;
        }

        // School Stamp Deduction: Fixed 1000
        const calcSchoolStamp = 1000;
        if (Number(financialData.school_stamp_deduction) !== calcSchoolStamp) {
            newFinancialData.school_stamp_deduction = calcSchoolStamp;
            shouldUpdate = true;
        }

        // Social Security Deduction: 0.25% of Nominal Salary
        const calcSocialSecurity = nominalSalary * 0.0025;
        if (Number(financialData.social_security_deduction) !== calcSocialSecurity) {
            newFinancialData.social_security_deduction = calcSocialSecurity;
            shouldUpdate = true;
        }

        if (shouldUpdate) {
            setFinancialData(newFinancialData);
        }
    }, [
        financialData?.nominal_salary,
        financialData?.certificate_percentage,
        financialData?.job_title,
        // Include values to avoid infinite loop checks
        financialData?.certificate_allowance,
        financialData?.engineering_allowance,
        financialData?.tax_deduction_amount,
        financialData?.retirement_deduction,
        financialData?.school_stamp_deduction,
        financialData?.social_security_deduction
    ]);

    const toggleSection = (sectionId: string) => {
        setExpandedSections(prev => {
            const isCurrentlyOpen = prev[sectionId as keyof typeof prev];
            // Close all sections, then toggle the target one
            const newState = {
                main_info: false,
                basic: false,
                allowances: false,
                deductions: false,
                admin_summary: false,
                yearly_records: false
            };

            if (!isCurrentlyOpen) {
                // Open only if it wasn't already open
                newState[sectionId as keyof typeof newState] = true;

                // Scroll to the section after state update
                setTimeout(() => {
                    const element = document.getElementById(`section-${sectionId}`);
                    if (element) {
                        const y = element.getBoundingClientRect().top + window.scrollY - 250; // Increased offset for header/tabs
                        window.scrollTo({ top: y, behavior: 'smooth' });
                    }
                }, 100);
            }
            return newState;
        });
    };

    const handleUpdateEmployee = async () => {
        if (!selectedEmployee || !financialData) return;
        setLoading(true);
        try {
            // التحقق من توافق الشهادة والنسبة
            const certText = financialData.certificate_text;
            const certPerc = Number(financialData.certificate_percentage || 0);

            let expectedPerc = 0;
            if (certText === 'المتوسطة') expectedPerc = 15;
            else if (certText === 'الاعدادية') expectedPerc = 25;
            else if (certText === 'دبلوم') expectedPerc = 35;
            else if (certText === 'بكلوريوس') expectedPerc = 45;
            else if (certText === 'دبلوم عالي') expectedPerc = 55;
            else if (certText === 'ماجستير') expectedPerc = 75;
            else if (certText === 'دكتوراه') expectedPerc = 85;

            // للشهادات الأقل من المتوسطة (ابتدائية، يقرأ ويكتب) النسبة يجب أن تكون 0
            if (certText === 'الابتدائية' || certText === 'يقرأ ويكتب') expectedPerc = 0;

            if (certPerc !== expectedPerc && certText) {
                toast.error(`خطأ: شهادة "${certText}" يجب أن تكون نسبتها ${expectedPerc}% وليس ${certPerc}%`);
                setLoading(false);
                return;
            }

            // 1. تحديث بيانات المستخدم الأساسية
            const { error: userError } = await supabase
                .from('app_users')
                .update({
                    full_name: selectedEmployee.full_name,
                    job_number: selectedEmployee.job_number,
                    username: selectedEmployee.username,
                    password: selectedEmployee.password,
                    role: selectedEmployee.role
                })
                .eq('id', selectedEmployee.id);

            if (userError) throw userError;

            // 2. تحديث البيانات المالية
            const { error: finError } = await supabase
                .from('financial_records')
                .upsert({
                    ...financialData,
                    user_id: selectedEmployee.id,
                    updated_at: new Date().toISOString()
                });

            if (finError) throw finError;

            // 3. تحديث البيانات الإدارية
            if (adminData) {
                const { error: admError } = await supabase
                    .from('administrative_summary')
                    .upsert({
                        ...adminData,
                        user_id: selectedEmployee.id,
                        updated_at: new Date().toISOString()
                    });
                if (admError) throw admError;
            }

            // 4. تحديث السجلات السنوية
            if (yearlyData && yearlyData.length > 0) {
                const { error: yError } = await supabase
                    .from('yearly_records')
                    .upsert(yearlyData.map(r => ({ ...r, updated_at: new Date().toISOString() })));
                if (yError) throw yError;
            }

            toast.success("تم حفظ كافة التعديلات بنجاح في قاعدة البيانات");

            // Reset to search view
            setSelectedEmployee(null);
            setFinancialData(null);
            setAdminData(null);
            setYearlyData([]);
            setSearchJobNumber("");
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error: any) {
            console.error("Update error:", error);
            toast.error(error.message || "فشل في حفظ التعديلات");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveEmployee = async (e: React.FormEvent) => {
        e.preventDefault();

        // التحقق من الحقول الإجبارية
        if (!formData.full_name || !formData.job_number || !formData.username || !formData.password) {
            toast.error("يرجى ملء جميع الحقول الأساسية (الاسم، الرقم الوظيفي، اسم المستخدم، كلمة المرور)");
            return;
        }

        setLoading(true);
        try {
            // Check for existing user to avoid 409 Conflict error
            const { data: existingUsers } = await supabase
                .from('app_users')
                .select('job_number, username')
                .or(`job_number.eq.${formData.job_number}, username.eq.${formData.username} `);

            if (existingUsers && existingUsers.length > 0) {
                const existing = existingUsers[0];
                if (existing.job_number === formData.job_number) {
                    toast.error("خطأ: هذا الرقم الوظيفي مستخدم بالفعل لموظف آخر!");
                } else if (existing.username === formData.username) {
                    toast.error("خطأ: اسم المستخدم هذا موجود بالفعل!");
                }
                return; // Stop execution to prevent 409 error
            }

            // 1. إضافة المستخدم في جدول app_users
            const { data: user, error: userError } = await supabase
                .from('app_users')
                .insert([formData])
                .select()
                .single();

            if (userError) throw userError;

            // 2. إنشاء سجل مالي فارغ لهذا المستخدم (بدون حقل year لتجنب الخطأ)
            const { error: financialError } = await supabase
                .from('financial_records')
                .insert([{
                    user_id: user.id,
                    nominal_salary: 0
                }]);

            if (financialError) throw financialError;

            toast.success("تم إضافة الموظف بنجاح، جارِ الانتقال للتعديل التفصيلي...");

            // 3. الانتقال التلقائي لواجهة الإدارة والتعديل التفصيلي
            setSearchJobNumber(formData.job_number);
            setActiveTab('admin_manage');

            // جلب البيانات فوراً لفتح واجهة التعديل
            setSelectedEmployee(user);
            setFinancialData({ user_id: user.id, nominal_salary: 0 });
            setExpandedSections({
                main_info: false,
                basic: false,
                allowances: false,
                deductions: false,
                admin_summary: false,
                yearly_records: false
            });

            // تمرير الشاشة ليعرض بداية التفاصيل
            setTimeout(() => {
                if (detailsRef.current) {
                    detailsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 100);

            // تصفير نموذج الإضافة للعملية القادمة
            setFormData({ username: "", password: "", full_name: "", job_number: "", role: "user" });
        } catch (error: any) {
            // Handle unique constraint violations
            if (error.code === '23505' || error.message?.includes('unique constraint')) {
                // Suppress console error for known validation issues
                if (error.message?.includes('job_number') || error.details?.includes('job_number')) {
                    toast.error("خطأ: هذا الرقم الوظيفي مستخدم بالفعل لموظف آخر!");
                } else if (error.message?.includes('username') || error.details?.includes('username')) {
                    toast.error("خطأ: اسم المستخدم هذا موجود بالفعل!");
                } else {
                    toast.error("خطأ: توجد بيانات مكررة (قد يكون الاسم أو الرقم الوظيفي)");
                }
            } else {
                console.error("Save error:", error);
                toast.error("فشل الحفظ: " + (error.message || "خطأ غير معروف"));
            }
        } finally {
            setLoading(false);
        }
    };

    const adminHeaderContent = (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
            <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-brand-green/20 text-brand-green border border-brand-green/20">
                    <Settings className="w-6 h-6" />
                </div>
                <h1 className="text-2xl font-bold text-white tracking-tight">إدارة النظام</h1>
            </div>

            <div className="flex bg-black/40 backdrop-blur-md p-1.5 rounded-2xl border border-white/5 shadow-inner w-full md:w-auto">
                <button
                    onClick={() => setActiveTab('admin_add')}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl transition-all font-bold text-sm",
                        activeTab === 'admin_add' ? "bg-brand-green text-white shadow-lg" : "text-white/40 hover:text-white/60"
                    )}
                >
                    <UserPlus className="w-4 h-4" />
                    <span>إضافة موظف</span>
                </button>
                <button
                    onClick={() => setActiveTab('admin_manage')}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl transition-all font-bold text-sm",
                        activeTab === 'admin_manage' ? "bg-brand-green text-white shadow-lg" : "text-white/40 hover:text-white/60"
                    )}
                >
                    <Search className="w-4 h-4" />
                    <span>إدارة الموظفين</span>
                </button>
            </div>
        </div>
    );

    return (
        <Layout className="pb-32" headerContent={adminHeaderContent}>
            <div className="max-w-4xl mx-auto px-4">

                {activeTab === 'admin_add' && (
                    <GlassCard className="p-8">
                        <form onSubmit={handleSaveEmployee} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-white/70 text-sm block px-1">الاسم الكامل للموظف</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="اكتب الاسم الرباعي واللقب"
                                        value={formData.full_name}
                                        onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                                        className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-white/20 focus:outline-none focus:border-brand-green/50 transition-colors"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-white/70 text-sm block px-1">الرقم الوظيفي</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="الرقم التعريفي (ID)"
                                        value={formData.job_number}
                                        onChange={e => setFormData({ ...formData, job_number: e.target.value })}
                                        className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-white/20 focus:outline-none focus:border-brand-green/50 transition-colors"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-white/70 text-sm block px-1">اسم المستخدم (للدخول)</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="User123"
                                        value={formData.username}
                                        onChange={e => setFormData({ ...formData, username: e.target.value })}
                                        className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-white/20 focus:outline-none focus:border-brand-green/50 transition-colors"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-white/70 text-sm block px-1">كلمة المرور المؤقتة</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="كلمة مرور الدخول"
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-white/20 focus:outline-none focus:border-brand-green/50 transition-colors"
                                    />
                                </div>
                            </div>

                            {/* صلاحية المستخدم */}
                            <div className="space-y-4">
                                <label className="text-white/70 text-sm block px-1">صلاحية النظام</label>
                                <div className="flex gap-4">
                                    {['user', 'admin'].map((role) => (
                                        <button
                                            key={role}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, role })}
                                            className={cn(
                                                "flex-1 flex items-center justify-between p-4 rounded-2xl border transition-all duration-300",
                                                formData.role === role
                                                    ? "bg-brand-green/20 border-brand-green text-white"
                                                    : "bg-white/5 border-white/10 text-white/40"
                                            )}
                                        >
                                            <span className="font-bold">{role === 'admin' ? 'مدير نظام' : 'مستخدم تطبيق'}</span>
                                            {formData.role === role && <Check className="w-5 h-5 text-brand-green" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                        </form>
                    </GlassCard>
                )}

                {activeTab === 'admin_manage' && (
                    <div className="space-y-6">
                        {/* البحث */}
                        <GlassCard className="p-4 flex gap-3">
                            <input
                                type="text"
                                placeholder="ادخل الرقم الوظيفي للبحث..."
                                value={searchJobNumber}
                                onChange={e => setSearchJobNumber(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 text-white focus:outline-none focus:border-brand-green/50"
                            />
                            <button
                                onClick={handleSearch}
                                disabled={loading}
                                className="bg-brand-green text-white p-3 rounded-xl hover:opacity-90 disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                            </button>
                        </GlassCard>


                        {financialData && selectedEmployee && (
                            <div ref={detailsRef} className="space-y-4 pt-10 scroll-mt-48">
                                {/* تعديل البيانات الأساسية */}
                                <div id="section-main_info" className="rounded-2xl overflow-hidden shadow-lg border border-white/5">
                                    <button
                                        onClick={() => toggleSection('main_info')}
                                        className="w-full p-4 flex items-center justify-between text-white transition-all bg-gradient-to-r from-emerald-600 to-emerald-500 hover:brightness-110"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="bg-white/20 p-2 rounded-lg">
                                                <User className="w-5 h-5" />
                                            </div>
                                            <span className="font-bold">البيانات الأساسية والحساب</span>
                                        </div>
                                        <ChevronDown className={cn("w-5 h-5 transition-transform duration-300", expandedSections.main_info ? "rotate-180" : "")} />
                                    </button>

                                    {expandedSections.main_info && (
                                        <div className="p-4 bg-black/20 border-t border-white/5 space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <label className="text-white/50 text-xs px-2">الاسم الكامل</label>
                                                    <input
                                                        type="text"
                                                        value={selectedEmployee.full_name || ""}
                                                        onChange={e => setSelectedEmployee({ ...selectedEmployee, full_name: e.target.value })}
                                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-green/30"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-white/50 text-xs px-2">الرقم الوظيفي الجديد</label>
                                                    <input
                                                        type="text"
                                                        value={selectedEmployee.job_number || ""}
                                                        onChange={e => setSelectedEmployee({ ...selectedEmployee, job_number: e.target.value })}
                                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-green/30"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-white/50 text-xs px-2">اسم المستخدم</label>
                                                    <input
                                                        type="text"
                                                        value={selectedEmployee.username || ""}
                                                        onChange={e => setSelectedEmployee({ ...selectedEmployee, username: e.target.value })}
                                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-green/30"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-white/50 text-xs px-2">كلمة المرور</label>
                                                    <input
                                                        type="text"
                                                        value={selectedEmployee.password || ""}
                                                        onChange={e => setSelectedEmployee({ ...selectedEmployee, password: e.target.value })}
                                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-green/30"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2 pt-2">
                                                <label className="text-white/50 text-xs px-2">نوع الصلاحية</label>
                                                <div className="flex gap-2">
                                                    {['user', 'admin'].map((role) => (
                                                        <button
                                                            key={role}
                                                            type="button"
                                                            onClick={() => setSelectedEmployee({ ...selectedEmployee, role })}
                                                            className={cn(
                                                                "flex-1 py-2 px-4 rounded-xl border text-sm transition-all",
                                                                selectedEmployee.role === role
                                                                    ? "bg-brand-green/20 border-brand-green text-white"
                                                                    : "bg-white/5 border-white/10 text-white/30"
                                                            )}
                                                        >
                                                            {role === 'admin' ? 'مدير' : 'مستخدم'}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="h-px bg-white/10 w-full" />

                                {/* الحقول المالية القابلة للتعديل */}
                                {[
                                    {
                                        id: 'basic',
                                        title: 'المعلومات الاساسية والرواتب',
                                        icon: User,
                                        color: 'from-blue-600 to-blue-500',
                                        fields: [
                                            {
                                                key: 'job_title',
                                                label: 'العنوان الوظيفي',
                                                options: [
                                                    'ر. مهندسين اقدم اول', 'ر. مهندسين اقدم', 'ر. مهندسين', 'مهندس', 'م. مهندس',
                                                    'ر. مبرمجين اقدم اول', 'ر. مبرمجين اقدم', 'ر. مبرمجين', 'مبرمج', 'م. مبرمج',
                                                    'ر. مشغلين اقدم اول', 'ر. مشغلين اقدم', 'ر. مشغلين', 'مشغل حاسبة', 'م. مشغل حاسبة',
                                                    'مدير فني اقدم', 'مدير فني', 'فني اقدم', 'فني', 'عامل خدمة'
                                                ]
                                            },
                                            {
                                                key: 'salary_grade',
                                                label: 'الدرجة في سلم الرواتب',
                                                options: Array.from({ length: 10 }, (_, i) => (i + 1).toString())
                                            },
                                            {
                                                key: 'salary_stage',
                                                label: 'المرحلة في الدرجة الوظيفية',
                                                options: Array.from({ length: 10 }, (_, i) => (i + 1).toString())
                                            },
                                            {
                                                key: 'certificate_text',
                                                label: 'الشهادة',
                                                options: ['دكتوراه', 'ماجستير', 'دبلوم عالي', 'بكلوريوس', 'دبلوم', 'الاعدادية', 'المتوسطة', 'الابتدائية', 'يقرأ ويكتب']
                                            },
                                            {
                                                key: 'certificate_percentage',
                                                label: 'النسبة المستحقة للشهادة',
                                                suffix: '%',
                                                options: ['0', '15', '25', '35', '45', '55', '75', '85']
                                            },
                                            { key: 'nominal_salary', label: 'الراتب الاسمي', isMoney: true },
                                        ]
                                    },
                                    {
                                        id: 'allowances',
                                        title: 'المخصصات',
                                        icon: Wallet,
                                        color: 'from-green-600 to-green-500',
                                        fields: [
                                            { key: 'certificate_allowance', label: 'مخصصات الشهادة', isMoney: true, disabled: true },
                                            { key: 'engineering_allowance', label: 'مخصصات هندسية', isMoney: true, disabled: true },
                                            { key: 'legal_allowance', label: 'مخصصات القانونية', isMoney: true, disabled: true },
                                            { key: 'transport_allowance', label: 'مخصصات النقل', isMoney: true, options: ['20000', '30000'] },
                                            { key: 'marital_allowance', label: 'مخصصات الزوجية', isMoney: true },
                                            { key: 'children_allowance', label: 'مخصصات الاطفال', isMoney: true },
                                            { key: 'position_allowance', label: 'مخصصات المنصب', isMoney: true },
                                            { key: 'risk_allowance', label: 'مخصصات الخطورة', isMoney: true },
                                            { key: 'additional_50_percent_allowance', label: 'مخصصات اضافية 50%', isMoney: true },
                                        ]
                                    },
                                    {
                                        id: 'deductions',
                                        title: 'الاستقطاعات',
                                        icon: Scissors,
                                        color: 'from-red-600 to-red-500',
                                        fields: [
                                            { key: 'tax_deduction_status', label: 'حالة الاستقطاع الضريبي' },
                                            { key: 'tax_deduction_amount', label: 'الاستقطاع الضريبي', isMoney: true, disabled: true },
                                            { key: 'loan_deduction', label: 'استقطاع مبلغ القرض', isMoney: true },
                                            { key: 'execution_deduction', label: 'استقطاع مبالغ التنفيذ', isMoney: true },
                                            { key: 'retirement_deduction', label: 'استقطاع التقاعد', isMoney: true, disabled: true },
                                            { key: 'school_stamp_deduction', label: 'استقطاع طابع مدرسي', isMoney: true, disabled: true },
                                            { key: 'social_security_deduction', label: 'استقطاع الحماية الاجتماعية', isMoney: true, disabled: true },
                                            { key: 'other_deductions', label: 'استقطاع مبلغ مطروح', isMoney: true },
                                        ]
                                    }
                                ].map((group: any) => (
                                    <div id={`section-${group.id}`} key={group.id} className="rounded-2xl overflow-hidden shadow-lg border border-white/5">
                                        <button
                                            onClick={() => toggleSection(group.id)}
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
                                                <span className="font-bold">{group.title}</span>
                                            </div>
                                            <ChevronDown className={cn(
                                                "w-5 h-5 transition-transform duration-300",
                                                expandedSections[group.id as keyof typeof expandedSections] ? "rotate-180" : ""
                                            )} />
                                        </button>

                                        {expandedSections[group.id as keyof typeof expandedSections] && (
                                            <div className="p-3 space-y-3 bg-black/20">
                                                {group.fields.map((field: any) => (
                                                    <div key={field.key} className="space-y-1">
                                                        <label className="text-white/50 text-xs px-2">{field.label}</label>
                                                        {field.options ? (
                                                            <div className="relative">
                                                                <select
                                                                    value={financialData[field.key] || ""}
                                                                    onChange={e => setFinancialData({ ...financialData, [field.key]: e.target.value })}
                                                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white appearance-none focus:outline-none focus:border-brand-green/30"
                                                                >
                                                                    <option value="" className="bg-zinc-900 text-white/50">اختر...</option>
                                                                    {field.options.map((opt: string) => (
                                                                        <option key={opt} value={opt} className="bg-zinc-900 text-white">{opt}</option>
                                                                    ))}
                                                                </select>
                                                                <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                                                            </div>
                                                        ) : (
                                                            <input
                                                                type="text"
                                                                value={financialData[field.key] || ""}
                                                                onChange={e => setFinancialData({ ...financialData, [field.key]: e.target.value })}
                                                                disabled={field.disabled}
                                                                className={cn(
                                                                    "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-green/30",
                                                                    field.disabled && "opacity-50 cursor-not-allowed bg-black/20"
                                                                )}
                                                            />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {/* Removed inline Save button here */}
                                <div className="pb-10"></div>
                            </div>
                        )}

                        {!selectedEmployee && !loading && (
                            <div className="text-center py-20">
                                <div className="p-4 bg-white/5 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4 border border-white/10">
                                    <User className="w-10 h-10 text-white/20" />
                                </div>
                                <h3 className="text-white font-bold text-xl mb-2">إدارة الموظفين</h3>
                                <p className="text-white/40">يرجى البحث عن موظف بواسطة الرقم الوظيفي لتعديل بياناته</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Sticky Action Footer */}
            <div className="fixed bottom-0 left-0 right-0 p-4 z-50 bg-gradient-to-t from-[#0f172a] via-[#0f172a] to-transparent pointer-events-none flex justify-center pb-6">
                <div className="pointer-events-auto bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-2 w-full max-w-2xl shadow-2xl flex items-center gap-4">
                    {activeTab === 'admin_add' && (
                        <button
                            onClick={(e) => handleSaveEmployee(e)}
                            disabled={loading}
                            className="flex-1 py-3 px-6 bg-brand-green hover:bg-brand-green/90 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-green/20 disabled:opacity-50 transition-all"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            <span>حفظ بيانات الموظف الجديد</span>
                        </button>
                    )}

                    {activeTab === 'admin_manage' && selectedEmployee && (
                        <button
                            onClick={handleUpdateEmployee}
                            disabled={loading}
                            className="flex-1 py-3 px-6 bg-brand-green hover:bg-brand-green/90 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-green/20 disabled:opacity-50 transition-all"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            <span>حفظ كافة التعديلات</span>
                        </button>
                    )}

                    {(!activeTab || (activeTab === 'admin_manage' && !selectedEmployee)) && (
                        <div className="flex-1 text-center py-3 text-white/40 text-sm">
                            الرجاء اختيار إجراء للبدء
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
};

