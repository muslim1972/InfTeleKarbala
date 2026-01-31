import { useState } from "react";
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
        basic: false,
        allowances: false,
        deductions: false
    });

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
                toast.success("تم جلب بيانات الموظف بنجاح");
            }

            // توسيع جميع الأقسام تلقائياً عند نجاح البحث
            setExpandedSections({
                basic: true,
                allowances: true,
                deductions: true
            });
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateEmployee = async () => {
        if (!selectedEmployee || !financialData) return;
        setLoading(true);
        try {
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

            toast.success("تم حفظ كافة التعديلات بنجاح في قاعدة البيانات");
        } catch (error: any) {
            console.error("Update error:", error);
            toast.error(error.message || "فشل في حفظ التعديلات");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
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
                basic: true,
                allowances: true,
                deductions: true
            });

            // تصفير نموذج الإضافة للعملية القادمة
            setFormData({ username: "", password: "", full_name: "", job_number: "", role: "user" });
        } catch (error: any) {
            console.error("Save error:", error);
            if (error.code === '23505') {
                const isJobNumber = error.message?.includes('job_number') || error.detail?.includes('job_number');
                if (isJobNumber) {
                    toast.error("عذراً، هذا الرقم الوظيفي مسجل لموظف آخر بالفعل. يرجى التأكد من الرقم.");
                } else {
                    toast.error("عذراً، اسم المستخدم هذا محجوز. يرجى اختيار اسم دخول مختلف.");
                }
            } else {
                toast.error("فشل الحفظ: " + (error.message || "خطأ غير معروف"));
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout className="pb-20">
            <div className="max-w-4xl mx-auto px-4">
                {/* Sticky Header Section */}
                <div className="sticky top-0 z-30 bg-[#0f172a]/95 backdrop-blur-xl pt-4 pb-2 -mx-4 px-4 mb-6 border-b border-white/10 shadow-xl">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2.5 rounded-xl bg-brand-green/20 text-brand-green border border-brand-green/20">
                            <Settings className="w-5 h-5 md:w-6 md:h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold text-white font-tajawal">لوحة تحكم المدير</h1>
                            <p className="text-white/60 text-xs md:text-sm">إدارة الموظفين والبيانات</p>
                        </div>
                    </div>

                    <div className="flex p-1 bg-black/40 backdrop-blur-md rounded-2xl border border-white/5">
                        <button
                            onClick={() => setActiveTab('admin_add')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl transition-all duration-300 font-bold text-sm md:text-base ${activeTab === 'admin_add' ? "bg-brand-green text-white shadow-lg" : "text-white/40 hover:text-white/60"
                                }`}
                        >
                            <UserPlus className="w-4 h-4 md:w-5 md:h-5" />
                            <span>إضافة موظف</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('admin_manage')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl transition-all duration-300 font-bold text-sm md:text-base ${activeTab === 'admin_manage' ? "bg-brand-green text-white shadow-lg" : "text-white/40 hover:text-white/60"
                                }`}
                        >
                            <Search className="w-4 h-4 md:w-5 md:h-5" />
                            <span>إدارة الموظفين</span>
                        </button>
                    </div>
                </div>

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

                            <button
                                disabled={loading}
                                className="w-full md:w-auto px-10 py-4 bg-brand-green text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-opacity-90 transition-all shadow-lg shadow-brand-green/20 disabled:opacity-50"
                            >
                                <Save className="w-5 h-5" />
                                <span>حفظ بيانات الموظف</span>
                            </button>
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
                            <div className="space-y-6">
                                {/* تعديل البيانات الأساسية */}
                                <GlassCard className="p-6 space-y-4 border-brand-green/20">
                                    <div className="flex items-center gap-2 mb-2 text-brand-green">
                                        <User className="w-5 h-5" />
                                        <h3 className="font-bold">البيانات الأساسية والحساب</h3>
                                    </div>
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
                                </GlassCard>

                                <div className="h-px bg-white/10 w-full" />

                                {/* الحقول المالية القابلة للتعديل */}
                                {[
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
                                        ]
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
                                        ]
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
                                        ]
                                    }
                                ].map(group => (
                                    <div key={group.id} className="rounded-2xl overflow-hidden shadow-lg border border-white/5">
                                        <button
                                            onClick={() => setExpandedSections(prev => ({ ...prev, [group.id]: !prev[group.id as keyof typeof expandedSections] }))}
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
                                                {group.fields.map(field => (
                                                    <div key={field.key} className="space-y-1">
                                                        <label className="text-white/50 text-xs px-2">{field.label}</label>
                                                        <input
                                                            type="text"
                                                            value={financialData[field.key] || ""}
                                                            onChange={e => setFinancialData({ ...financialData, [field.key]: e.target.value })}
                                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-green/30"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}

                                <button
                                    onClick={handleUpdateEmployee}
                                    disabled={loading}
                                    className="w-full py-4 bg-brand-green text-white rounded-2xl font-bold flex items-center justify-center gap-2 mt-6 shadow-xl hover:shadow-brand-green/20 hover:scale-[1.01] active:scale-[0.98] transition-all"
                                >
                                    <Save className="w-5 h-5" />
                                    <span>حفظ كافة التعديلات المذكورة</span>
                                </button>
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
        </Layout>
    );
};
