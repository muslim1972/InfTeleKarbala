import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { toast } from "react-hot-toast";
import { Loader2, Plus, Edit, Trash2, Save, Network, Check, X, Edit2, Search } from "lucide-react";

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

    // Inline Manager Editing State
    const [editingManagerNodeId, setEditingManagerNodeId] = useState<string | null>(null);
    const [managerSearch, setManagerSearch] = useState("");

    // Inline Name Editing State
    const [editingNameNodeId, setEditingNameNodeId] = useState<string | null>(null);
    const [tempNodeName, setTempNodeName] = useState("");

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

    const saveInlineManager = async (deptId: string, newManagerId: string | null) => {
        setSaving(true);
        try {
            const { error } = await supabase
                .from('departments')
                .update({ manager_id: newManagerId, updated_at: new Date().toISOString() })
                .eq('id', deptId);

            if (error) throw error;
            toast.success("تم تحديث المسؤول بنجاح");

            // Update local state without refetching immediately
            setDepartments(departments.map(d => d.id === deptId ? { ...d, manager_id: newManagerId } : d));
            setEditingManagerNodeId(null);
        } catch (error: any) {
            console.error("Inline manager save error:", error);
            toast.error("فشل تحديث المسؤول: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    const saveInlineName = async (deptId: string, newName: string) => {
        if (!newName.trim()) {
            toast.error("لا يمكن ترك اسم التشكيل فارغاً");
            return;
        }
        setSaving(true);
        try {
            const { error } = await supabase
                .from('departments')
                .update({ name: newName.trim(), updated_at: new Date().toISOString() })
                .eq('id', deptId);

            if (error) throw error;
            toast.success("تم تغيير الاسم بنجاح");

            // Update local state without refetching immediately
            setDepartments(departments.map(d => d.id === deptId ? { ...d, name: newName.trim() } : d));
            setEditingNameNodeId(null);
        } catch (error: any) {
            console.error("Inline name save error:", error);
            toast.error("فشل تغيير الاسم: " + error.message);
        } finally {
            setSaving(false);
        }
    };


    const cancelEdit = () => {
        setIsEditing(false);
        setCurrentDept({ name: "", level: 3, parent_id: null, manager_id: null });
    };

    // Recursive function to render the tree
    const renderNode = (dept: Department, allDepts: Department[]) => {
        const children = allDepts.filter(d => d.parent_id === dept.id);

        return (
            <div key={dept.id} className="w-full relative">
                <div className={`flex flex-col md:flex-row md:items-center justify-between p-3 border border-gray-100 dark:border-white/5 rounded-xl shadow-sm transition-all hover:shadow-md ${theme === 'light' ? 'bg-white' : 'bg-slate-800'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${theme === 'light' ? 'bg-brand-green/10 text-brand-green' : 'bg-brand-green/20 text-brand-green'}`}>
                            <Network className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col w-full">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1 w-full">
                                {editingNameNodeId === dept.id ? (
                                    <div className="flex items-center gap-2 w-full max-w-sm">
                                        <input
                                            type="text"
                                            value={tempNodeName}
                                            onChange={(e) => setTempNodeName(e.target.value)}
                                            className={`flex-1 px-2 py-1 text-sm font-bold rounded border outline-none ${theme === 'light' ? 'bg-white border-brand-green/50 focus:ring-2 focus:ring-brand-green/30' : 'bg-slate-900 border-brand-green/50 focus:ring-2 focus:ring-brand-green/30 text-white'}`}
                                            autoFocus
                                            onKeyDown={(e) => { if (e.key === 'Enter') saveInlineName(dept.id, tempNodeName); if (e.key === 'Escape') setEditingNameNodeId(null); }}
                                        />
                                        <button onClick={() => saveInlineName(dept.id, tempNodeName)} className="p-1.5 text-white bg-brand-green hover:bg-brand-green/90 rounded shrink-0 transition-colors" title="حفظ الاسم"><Check className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => setEditingNameNodeId(null)} className="p-1.5 text-gray-600 bg-gray-200 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 rounded shrink-0 transition-colors" title="إلغاء"><X className="w-3.5 h-3.5" /></button>
                                    </div>
                                ) : (
                                    <>
                                        <span className={`font-bold ${theme === 'light' ? 'text-gray-800' : 'text-gray-100'}`}>
                                            {dept.name}
                                        </span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full w-fit ${theme === 'light' ? 'bg-brand-green/10 text-brand-green' : 'bg-brand-green/20 text-brand-green'}`}>
                                            مستوى {dept.level}
                                        </span>
                                    </>
                                )}
                            </div>

                            <div className="flex flex-col mt-1 w-full">
                                <span className={`text-[11px] ml-1 mb-1 block ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>المسؤول:</span>
                                {editingManagerNodeId === dept.id ? (
                                    <div className="w-full max-w-sm relative">
                                        <div className={`flex flex-col gap-1 w-full p-2 rounded-lg border shadow-sm ${theme === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-slate-900 border-white/10'}`}>
                                            <div className="relative w-full">
                                                <Search className="w-4 h-4 text-gray-400 absolute right-2 top-2.5" />
                                                <input
                                                    type="text"
                                                    placeholder="البحث باسم الموظف..."
                                                    value={managerSearch}
                                                    onChange={e => setManagerSearch(e.target.value)}
                                                    className={`w-full pr-8 pl-2 py-2 text-sm rounded border ${theme === 'light' ? 'bg-white border-gray-300 focus:border-brand-green outline-none' : 'bg-slate-800 border-white/20 text-white focus:border-brand-green outline-none'}`}
                                                    autoFocus
                                                />
                                                {/* AUTOCOMPLETE DROPDOWN */}
                                                {managerSearch && (
                                                    <div className={`absolute z-20 w-full mt-1 max-h-40 overflow-y-auto rounded-md shadow-lg border ${theme === 'light' ? 'bg-white border-gray-200' : 'bg-slate-800 border-white/10'}`}>
                                                        {users.filter(u => u.full_name.includes(managerSearch)).slice(0, 5).map(u => (
                                                            <div
                                                                key={u.id}
                                                                onClick={() => saveInlineManager(dept.id, u.id)}
                                                                className={`p-2 text-sm cursor-pointer border-b last:border-0 ${theme === 'light' ? 'hover:bg-brand-green/10 border-gray-100 text-gray-800' : 'hover:bg-brand-green/20 border-white/5 text-gray-200'}`}
                                                            >
                                                                {u.full_name}
                                                            </div>
                                                        ))}
                                                        {users.filter(u => u.full_name.includes(managerSearch)).length === 0 && (
                                                            <div className="p-2 text-sm text-gray-500 text-center">لا يوجد موظف بهذا الاسم</div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex gap-2 w-full mt-1">
                                                <button onClick={() => saveInlineManager(dept.id, null)} className={`flex-1 flex justify-center items-center py-1.5 text-xs rounded transition-colors ${theme === 'light' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-red-900/30 text-red-400 hover:bg-red-900/50'}`}>إزالة المسؤول</button>
                                                <button onClick={() => setEditingManagerNodeId(null)} className={`flex-1 py-1.5 text-xs rounded transition-colors ${theme === 'light' ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-slate-700 text-gray-200 hover:bg-slate-600'}`}>إلغاء</button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div
                                        className="flex items-center gap-2 group/manager cursor-pointer w-fit"
                                        onClick={() => {
                                            setEditingManagerNodeId(dept.id);
                                            setManagerSearch("");
                                        }}
                                        title="انقر لتعيين مسؤول"
                                    >
                                        <span className={`text-[12px] font-semibold transition-colors ${theme === 'light' ? 'text-gray-700 hover:text-brand-green' : 'text-gray-300 hover:text-brand-green'} ${!dept.manager_id && 'text-red-500/80'}`}>
                                            {users.find(u => u.id === dept.manager_id)?.full_name || 'لا يوجد مسؤول (انقر للتعيين)'}
                                        </span>
                                        <Edit2 className="w-3 h-3 opacity-0 group-hover/manager:opacity-100 transition-opacity text-brand-green" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2 mt-3 md:mt-0 justify-end md:justify-start">
                        <button
                            onClick={() => {
                                setEditingNameNodeId(dept.id);
                                setTempNodeName(dept.name);
                            }}
                            className={`p-2 rounded-lg transition-colors ${theme === 'light' ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' : 'text-blue-400 bg-blue-900/20 hover:bg-blue-900/40'}`}
                            title="تعديل اسم التشكيل"
                        >
                            <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(dept.id)} className={`p-2 rounded-lg transition-colors ${theme === 'light' ? 'text-red-600 bg-red-50 hover:bg-red-100' : 'text-red-400 bg-red-900/20 hover:bg-red-900/40'}`} title="حذف التشكيل">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Render Children with Vertical & Horizontal Tree Lines */}
                {children.length > 0 && (
                    <div className="flex flex-col w-full pr-8 relative mt-3 mr-4">
                        {children.map((child, index) => {
                            const isLast = index === children.length - 1;
                            return (
                                <div key={child.id} className="relative w-full mb-3">
                                    {/* Vertical Line */}
                                    <div
                                        className={`absolute right-[-24px] top-[-12px] w-[2px] ${isLast ? 'h-[2.5rem]' : 'h-[calc(100%+12px)]'} ${theme === 'light' ? 'bg-gray-200' : 'bg-gray-700/60'}`}
                                    />

                                    {/* Horizontal Line */}
                                    <div
                                        className={`absolute right-[-24px] top-[1.5rem] w-6 h-[2px] ${theme === 'light' ? 'bg-gray-200' : 'bg-gray-700/60'}`}
                                    />

                                    {renderNode(child, allDepts)}
                                </div>
                            );
                        })}
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
