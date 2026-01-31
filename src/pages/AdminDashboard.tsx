import { useState } from "react";
import { Layout } from "../components/layout/Layout";
import { GlassCard } from "../components/ui/GlassCard";
import { UserPlus, Settings, Save, Search, User } from "lucide-react";
import { supabase } from "../lib/supabase";
import { toast } from "react-hot-toast";

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

            // 2. إنشاء سجل مالي فارغ لهذا المستخدم
            const { error: financialError } = await supabase
                .from('financial_records')
                .insert([{
                    user_id: user.id,
                    year: new Date().getFullYear(),
                    nominal_salary: 0
                }]);

            if (financialError) throw financialError;

            toast.success("تم إضافة الموظف بنجاح");
            setFormData({ username: "", password: "", full_name: "", job_number: "", role: "user" });
        } catch (error: any) {
            toast.error(error.message || "فشل في حفظ البيانات");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout className="pb-20">
            <div className="max-w-4xl mx-auto px-4">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 rounded-2xl bg-brand-green/20 text-brand-green border border-brand-green/20">
                        <Settings className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white font-tajawal">لوحة تحكم المدير</h1>
                        <p className="text-white/60">إدارة الموظفين والبيانات</p>
                    </div>
                </div>

                <div className="flex p-1 bg-black/40 backdrop-blur-md rounded-2xl border border-white/5 mb-8">
                    <button
                        onClick={() => setActiveTab('admin_add')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl transition-all duration-300 font-bold ${activeTab === 'admin_add' ? "bg-brand-green text-white shadow-lg" : "text-white/40 hover:text-white/60"
                            }`}
                    >
                        <UserPlus className="w-5 h-5" />
                        <span>إضافة موظف</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('admin_manage')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl transition-all duration-300 font-bold ${activeTab === 'admin_manage' ? "bg-brand-green text-white shadow-lg" : "text-white/40 hover:text-white/60"
                            }`}
                    >
                        <Search className="w-5 h-5" />
                        <span>إدارة الموظفين</span>
                    </button>
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
                    <div className="text-center py-20">
                        <div className="p-4 bg-white/5 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4 border border-white/10">
                            <User className="w-10 h-10 text-white/20" />
                        </div>
                        <h3 className="text-white font-bold text-xl mb-2">قريباً: إدارة الموظفين</h3>
                        <p className="text-white/40">ستتمكن هنا من تعديل رواتب وبيانات الموظفين الحاليين</p>
                    </div>
                )}
            </div>
        </Layout>
    );
};
