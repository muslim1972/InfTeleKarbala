import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { toast } from "react-hot-toast";
import { Loader2, Plus, Edit, Trash2, Save, Network } from "lucide-react";

interface Department {
    id: string;
    name: string;
    level: number;
    parent_id: string | null;
    manager_id: string | null;
    manager_name?: string; // Fetched from profiles
}

interface UserProfile {
    id: string;
    full_name: string;
}

interface DepartmentsManagerProps {
    theme: string;
}

export const DepartmentsManager: React.FC<DepartmentsManagerProps> = ({ theme }) => {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form State for Adding/Editing
    const [isEditing, setIsEditing] = useState(false);
    const [currentDept, setCurrentDept] = useState<Partial<Department>>({
        name: "",
        level: 3,
        parent_id: null,
        manager_id: null,
    });

    const fetchDepartments = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('departments')
                .select('*')
                .order('level', { ascending: true })
                .order('name', { ascending: true });

            if (error) {
                console.error("Supabase error fetching departments:", error);
                toast.error("خطأ تقني في جلب الهيكلية: " + error.message);
                throw error;
            }

            setDepartments(data || []);
        } catch (error: any) {
            console.error("Error fetching departments:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name')
                .order('full_name');

            if (error) throw error;
            setUsers(data || []);
        } catch (error) {
            console.error("Error fetching users:", error);
        }
    };

    useEffect(() => {
        fetchDepartments();
        fetchUsers();
    }, []);

    const handleSave = async () => {
        if (!currentDept.name) {
            toast.error("يرجى إدخال اسم التشكيل");
            return;
        }

        setSaving(true);
        try {
            let error;
            if (currentDept.id) {
                // Update
                const res = await supabase
                    .from('departments')
                    .update({
                        name: currentDept.name,
                        level: currentDept.level,
                        parent_id: currentDept.parent_id,
                        manager_id: currentDept.manager_id,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', currentDept.id);
                error = res.error;
            } else {
                // Insert
                const res = await supabase
                    .from('departments')
                    .insert([{
                        name: currentDept.name,
                        level: currentDept.level,
                        parent_id: currentDept.parent_id,
                        manager_id: currentDept.manager_id
                    }]);
                error = res.error;
            }

            if (error) throw error;
            toast.success(currentDept.id ? "تم التعديل بنجاح" : "تمت الإضافة بنجاح");
            setIsEditing(false);
            setCurrentDept({ name: "", level: 3, parent_id: null, manager_id: null });
            fetchDepartments();
        } catch (error: any) {
            console.error("Save error:", error);
            toast.error("فشل في الحفظ: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("هل أنت متأكد من حذف هذا التشكيل؟ قد تفقد ارتباطات الموظفين به.")) return;

        try {
            setLoading(true);
            const { error } = await supabase.from('departments').delete().eq('id', id);
            if (error) throw error;
            toast.success("تم الحذف بنجاح");
            fetchDepartments();
        } catch (error: any) {
            console.error("Delete error:", error);
            toast.error("فشل الحذف، قد يكون التشكيل مرتبطاً بأقسام أو موظفين آخرين.");
        } finally {
            setLoading(false);
        }
    };

    const editNode = (dept: Department) => {
        setCurrentDept(dept);
        setIsEditing(true);
    };

    const cancelEdit = () => {
        setIsEditing(false);
        setCurrentDept({ name: "", level: 3, parent_id: null, manager_id: null });
    };

    // Recursive function to render the tree
    const renderNode = (dept: Department, allDepts: Department[], depth: number = 0) => {
        const children = allDepts.filter(d => d.parent_id === dept.id);

        return (
            <div key={dept.id} className="w-full">
                <div className={`flex items-center justify-between p-3 border-b border-gray-100 dark:border-white/5 transition-colors hover:bg-gray-50 dark:hover:bg-white/5`}
                    style={{ paddingRight: `${depth * 1.5 + 1}rem` }}
                >
                    <div className="flex items-center gap-3">
                        {depth > 0 && <div className="w-4 h-[1px] bg-gray-300 dark:bg-gray-600 block shrink-0" />}
                        <div>
                            <div className="flex items-center gap-2">
                                <span className={`font-bold ${theme === 'light' ? 'text-gray-800' : 'text-gray-200'}`}>
                                    {dept.name}
                                </span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${theme === 'light' ? 'bg-blue-100 text-blue-700' : 'bg-blue-900/30 text-blue-400'}`}>
                                    مستوى {dept.level}
                                </span>
                            </div>
                            {dept.manager_id && (
                                <p className={`text-xs mt-1 ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>
                                    المدير/المسؤول: {users.find(u => u.id === dept.manager_id)?.full_name || 'مسؤول غير معروف'}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button onClick={() => editNode(dept)} className={`p-1.5 rounded-md ${theme === 'light' ? 'text-blue-600 hover:bg-blue-50' : 'text-blue-400 hover:bg-blue-900/30'}`} title="تعديل">
                            <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(dept.id)} className={`p-1.5 rounded-md ${theme === 'light' ? 'text-red-600 hover:bg-red-50' : 'text-red-400 hover:bg-red-900/30'}`} title="حذف">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                {/* Render Children */}
                {children.length > 0 && (
                    <div className="flex flex-col w-full">
                        {children.map(child => renderNode(child, allDepts, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    // Find top-level nodes (no parent) and render them first
    const rootNodes = departments.filter(d => !d.parent_id);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full px-2 md:container md:mx-auto items-start">

            {/* Tree Section (Main View) */}
            <div className={`lg:col-span-2 rounded-2xl border shadow-sm overflow-hidden \${theme === 'light' ? 'bg-white border-gray-200' : 'bg-slate-900 border-white/10'}`}>
                <div className={`p-4 border-b flex items-center justify-between \${theme === 'light' ? 'bg-gray-50/80 border-gray-200' : 'bg-white/5 border-white/10'}`}>
                    <div>
                        <h3 className={`font-bold text-lg \${theme === 'light' ? 'text-gray-800' : 'text-white'}`}>شجرة الهيكلية الإدارية</h3>
                        <p className={`text-xs mt-1 \${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>
                            استعراض الأقسام، المجمعات، والشعب
                        </p>
                    </div>
                </div>

                <div className="flex flex-col">
                    {loading ? (
                        <div className="p-8 flex justify-center">
                            <Loader2 className="w-6 h-6 animate-spin text-brand-green" />
                        </div>
                    ) : rootNodes.length > 0 ? (
                        rootNodes.map(node => renderNode(node, departments))
                    ) : (
                        <div className={`p-8 text-center \${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>
                            لا توجد أي أقسام أو شعب مضافة حتى الآن.
                        </div>
                    )}
                </div>
            </div>

            {/* Form Section (Sidebar) */}
            <div className={`lg:col-span-1 lg:sticky lg:top-6 p-6 rounded-2xl border shadow-sm \${theme === 'light' ? 'bg-white border-gray-200' : 'bg-slate-900 border-white/10'}`}>
                <div className="flex items-center gap-3 mb-6">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center \${theme === 'light' ? 'bg-brand-green/10 text-brand-green' : 'bg-brand-green/20 text-brand-green'}`}>
                        <Network className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className={`font-bold text-lg \${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                            {isEditing ? 'تعديل التشكيل الإداري' : 'إضافة تشكيل جديد'}
                        </h2>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 mb-4">
                    <div className="space-y-1.5">
                        <label className={`text-sm font-semibold \${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>اسم التشكيل</label>
                        <input
                            type="text"
                            value={currentDept.name}
                            onChange={(e) => setCurrentDept({ ...currentDept, name: e.target.value })}
                            placeholder="مثال: قسم الشبكات"
                            className={`w-full p-2.5 rounded-lg border focus:outline-none focus:ring-2 \${theme === 'light' ? 'bg-white border-gray-300 text-gray-900 focus:ring-brand-green/50' : 'bg-slate-800 border-white/10 text-white focus:ring-brand-green/50'}`}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className={`text-sm font-semibold \${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>المستوى الإداري</label>
                        <select
                            value={currentDept.level}
                            onChange={(e) => setCurrentDept({ ...currentDept, level: parseInt(e.target.value) })}
                            className={`w-full p-2.5 rounded-lg border focus:outline-none focus:ring-2 \${theme === 'light' ? 'bg-white border-gray-300 text-gray-900 focus:ring-brand-green/50' : 'bg-slate-800 border-white/10 text-white focus:ring-brand-green/50'}`}
                        >
                            <option value={1}>مستوى 1 (المدير)</option>
                            <option value={2}>مستوى 2 (المعاون)</option>
                            <option value={3}>مستوى 3 (أقسام / مجمعات رئيسية)</option>
                            <option value={4}>مستوى 4 (شعب فرعية)</option>
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className={`text-sm font-semibold \${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>المرجع الأعلى (الارتباط)</label>
                        <select
                            value={currentDept.parent_id || ""}
                            onChange={(e) => setCurrentDept({ ...currentDept, parent_id: e.target.value || null })}
                            className={`w-full p-2.5 rounded-lg border focus:outline-none focus:ring-2 \${theme === 'light' ? 'bg-white border-gray-300 text-gray-900 focus:ring-brand-green/50' : 'bg-slate-800 border-white/10 text-white focus:ring-brand-green/50'}`}
                        >
                            <option value="">-- كجهة رئيسية عليا --</option>
                            {departments.filter(d => d.id !== currentDept.id).map(d => (
                                <option key={d.id} value={d.id}>{d.name} (مستوى {d.level})</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className={`text-sm font-semibold \${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>المسؤول (المدير/مسؤول الشعبة)</label>
                        <select
                            value={currentDept.manager_id || ""}
                            onChange={(e) => setCurrentDept({ ...currentDept, manager_id: e.target.value || null })}
                            className={`w-full p-2.5 rounded-lg border focus:outline-none focus:ring-2 \${theme === 'light' ? 'bg-white border-gray-300 text-gray-900 focus:ring-brand-green/50' : 'bg-slate-800 border-white/10 text-white focus:ring-brand-green/50'}`}
                        >
                            <option value="">-- بدون مسؤول حالياً --</option>
                            {users.map(u => (
                                <option key={u.id} value={u.id}>{u.full_name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex flex-col gap-3 mt-6">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full py-3 bg-brand-green hover:bg-brand-green/90 text-white rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : (isEditing ? <Save className="w-5 h-5" /> : <Plus className="w-5 h-5" />)}
                        {isEditing ? 'حفظ التغييرات' : 'إضافة للهيكلية'}
                    </button>
                    {isEditing && (
                        <button
                            onClick={cancelEdit}
                            className={`w-full py-2.5 rounded-lg font-bold transition-colors \${theme === 'light' ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-white/10 text-white hover:bg-white/20'}`}
                        >
                            إلغاء التعديل
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
