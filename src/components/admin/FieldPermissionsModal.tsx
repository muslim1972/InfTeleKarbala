import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../lib/supabase";
import { toast } from "react-hot-toast";
import { X, Shield, Save, Loader2, UserPlus } from "lucide-react";
import { EmployeeSearch } from "../shared/EmployeeSearch";

interface FieldPermissionsModalProps {
    onClose: () => void;
    theme: string;
}

interface FieldPermission {
    column_name: string;
    permission_levels: number[];
}

/** مستخدم مَنُوح له فردياً على ميزة ftth_simulator */
interface FtthGrantedUser {
    user_id: string;
    full_name: string;
    job_number?: string | null;
}

export const FieldPermissionsModal = ({ onClose, theme }: FieldPermissionsModalProps) => {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [permissions, setPermissions] = useState<FieldPermission[]>([]);
    // المنح الفردية لـ ftth_simulator — يُحفظ عند «حفظ» الفروقات فقط
    const [ftthUsers, setFtthUsers] = useState<FtthGrantedUser[]>([]);
    const [ftthSearchValue, setFtthSearchValue] = useState('');
    const initialFtthUserIds = useRef<Set<string>>(new Set());

    // Define the static list of all fields
    const allFields = [
        // --- الأساسية والحسابات ---
        { key: 'full_name', label: 'الاسم الكامل' },
        { key: 'username', label: 'اسم المستخدم' },
        { key: 'password', label: 'كلمة المرور' },
        { key: 'role', label: 'نوع الحساب (مشرف/موظف)' },
        { key: 'job_number', label: 'الرقم الوظيفي الموحد' },
        { key: 'first_hire_date', label: 'تاريخ اول تعيين' },
        { key: 'department_id', label: 'القسم / الشعبة (التشكيل الإداري)' },
        // --- السجلات الإدارية ---
        { key: 'thanks', label: 'سجلات: كتب الشكر' },
        { key: 'committees', label: 'سجلات: اللجان' },
        { key: 'penalties', label: 'سجلات: العقوبات' },
        // --- تبويبات النظام ---
        { key: 'tab_supervisors', label: 'تبويبة المشرفون' },
        { key: 'tab_training', label: 'تبويبة التدريب الصيفي' },
        { key: 'tab_requests', label: 'تبويبة الطلبات' },
        { key: 'tab_news', label: 'تبويبة الاعلام' },
        // --- ميزات حصرية بالمنح ---
        { key: 'ftth_simulator', label: 'تطوير محاكي بناء شبكة FTTH' },
        // --- البيانات المالية والوظيفية ---
        { key: 'job_title', label: 'العنوان الوظيفي' },
        { key: 'salary_grade', label: 'الدرجة في سلم الرواتب' },
        { key: 'salary_stage', label: 'المرحلة في الدرجة الوظيفية' },
        { key: 'certificate_text', label: 'التحصيل الدراسي' },
        { key: 'certificate_percentage', label: 'النسبة المستحقة للشهادة' },
        { key: 'nominal_salary', label: 'الراتب الاسمي' },
        { key: 'risk_percentage', label: 'الخطورة %' },
        { key: 'certificate_allowance', label: 'م. الشهادة' },
        { key: 'engineering_allowance', label: 'م. هندسية' },
        { key: 'legal_allowance', label: 'م. القانونية' },
        { key: 'transport_allowance', label: 'م. النقل' },
        { key: 'marital_allowance', label: 'م. الزوجية' },
        { key: 'children_allowance', label: 'م. الاطفال' },
        { key: 'position_allowance', label: 'م. المنصب' },
        { key: 'risk_allowance', label: 'م. الخطورة' },
        { key: 'additional_50_percent_allowance', label: 'م. اضافية 50%' },
        { key: 'tax_deduction_status', label: 'حالة الاستقطاع الضريبي' },
        { key: 'tax_deduction_amount', label: 'الاستقطاع الضريبي' },
        { key: 'loan_deduction', label: 'استقطاع مبلغ القرض' },
        { key: 'execution_deduction', label: 'استقطاع مبالغ التنفيذ' },
        { key: 'retirement_deduction', label: 'استقطاع التقاعد' },
        { key: 'school_stamp_deduction', label: 'استقطاع طابع مدرسي' },
        { key: 'social_security_deduction', label: 'استقطاع الحماية الاجتماعية' },
        { key: 'other_deductions', label: 'استقطاع مبلغ مطروح' },
        { key: 'gross_salary', label: 'الراتب الاجمالي (قبل الاستقطاع)' },
        { key: 'net_salary', label: 'الراتب الصافي (مستحق الدفع)' }
    ];

    // الافتراضي الآمن لكل حقل عند غياب سجلبه في قاعدة البيانات:
    // الحقول المعتادة تُفتح للمستوى 4 (عام)، أما الميزات الحصرية بالمنح
    // (ftth_simulator) فتبقى مخفية عن الجميع حتى يمنحها المطور صراحة.
    const defaultLevelsFor = (key: string): number[] => (key === 'ftth_simulator' ? [] : [4]);

    const fetchPermissions = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('field_permissions')
                .select('*');

            if (error) {
                // If table doesn't exist yet, we'll catch it here and just use defaults
                console.error("Error fetching permissions (ensure SQL script is run):", error);

                // Set default permissions (everyone level 4، والميزات
                // الحصرية بالمنح مثل ftth_simulator تبقى مخفية)
                const defaultPerms = allFields.map(f => ({
                    column_name: f.key,
                    permission_levels: defaultLevelsFor(f.key)
                }));
                setPermissions(defaultPerms);
                return;
            }

            // Merge fetched permissions with all fields list, defaulting
            // missing keys via defaultLevelsFor (ftth_simulator → مخفي [])
            const mergedPerms = allFields.map(field => {
                const found = data?.find(p => p.column_name === field.key);
                let levels = defaultLevelsFor(field.key);
                if (found) {
                    if (Array.isArray(found.permission_levels)) {
                        levels = found.permission_levels;
                    } else if (found.permission_level) {
                        levels = [found.permission_level]; // Fallback for old schema
                    }
                }
                return {
                    column_name: field.key,
                    permission_levels: levels
                };
            });

            setPermissions(mergedPerms);
        } catch (error) {
            console.error("Fetch permissions error:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPermissions();
        fetchFtthGrants();
    }, []);

    // جلب المنح الفردية الحالية لـ ftth_simulator (مع بيانات الموظف)
    const fetchFtthGrants = async () => {
        const { data, error } = await supabase
            .from('field_user_permissions')
            .select('user_id, profile:profiles!field_user_permissions_user_id_fkey(full_name, job_number)')
            .eq('column_name', 'ftth_simulator');

        if (error) {
            // غياب الجدول (لم يُطبَّق SQL بعد) → قسم فارغ دون تعطيل النافذة
            console.error("Error fetching FTTH individual grants:", error);
            return;
        }

        const rows: FtthGrantedUser[] = (data || []).map((r: any) => ({
            user_id: r.user_id,
            full_name: r.profile?.full_name || 'مستخدم',
            job_number: r.profile?.job_number ?? null
        }));
        setFtthUsers(rows);
        initialFtthUserIds.current = new Set(rows.map(r => r.user_id));
    };

    const handleAddFtthUser = (user: any) => {
        if (!user?.id) return;
        setFtthUsers(prev => prev.some(u => u.user_id === user.id)
            ? prev
            : [...prev, {
                user_id: user.id,
                full_name: user.full_name || 'مستخدم',
                job_number: user.job_number ?? null
            }]);
        setFtthSearchValue('');
    };

    const handleRemoveFtthUser = (userId: string) => {
        setFtthUsers(prev => prev.filter(u => u.user_id !== userId));
    };

    const handleLevelToggle = (columnName: string, level: number) => {
        setPermissions(prev => prev.map(p => {
            if (p.column_name === columnName) {
                const currentLevels = p.permission_levels || [];
                const newLevels = currentLevels.includes(level) 
                    ? currentLevels.filter(l => l !== level)
                    : [...currentLevels, level];
                return { ...p, permission_levels: newLevels };
            }
            return p;
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Upsert all permissions
            const { error } = await supabase
                .from('field_permissions')
                .upsert(
                    permissions.map(p => ({
                        column_name: p.column_name,
                        permission_levels: p.permission_levels,
                        updated_at: new Date().toISOString()
                    }))
                );

            if (error) throw error;

            // حفظ المنح الفردية لـ ftth_simulator: إضافة الجديد وحذف المسحوب فقط
            const currentIds = new Set(ftthUsers.map(u => u.user_id));
            const added = ftthUsers.filter(u => !initialFtthUserIds.current.has(u.user_id));
            const removed = Array.from(initialFtthUserIds.current).filter(id => !currentIds.has(id));

            if (added.length > 0) {
                const { data: authData } = await supabase.auth.getUser();
                const { error: addError } = await supabase
                    .from('field_user_permissions')
                    .insert(added.map(u => ({
                        column_name: 'ftth_simulator',
                        user_id: u.user_id,
                        granted_by: authData?.user?.id ?? null
                    })));
                if (addError) throw addError;
            }
            if (removed.length > 0) {
                const { error: delError } = await supabase
                    .from('field_user_permissions')
                    .delete()
                    .eq('column_name', 'ftth_simulator')
                    .in('user_id', removed);
                if (delError) throw delError;
            }

            toast.success("تم حفظ صلاحيات الحقول بنجاح");
            onClose();
        } catch (error: any) {
            console.error("Save error:", error);
            // Show more helpful error message if table is missing
            if (error.code === '42P01') {
                toast.error("خطأ: الجدول field_permissions غير موجود. يرجى تنفيذ ملف create_field_permissions.sql في قاعدة البيانات أولاً.", { duration: 6000 });
            } else {
                toast.error("فشل حفظ الصلاحيات: " + error.message);
            }
        } finally {
            setSaving(false);
        }
    };

    // التصيير عبر portal إلى document.body لتحرير النافذة من سياق التكديس
    // لأي سلف (transform / backdrop-filter) يجعل fixed مرتبطاً به بدل الـ viewport
    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className={`relative w-full max-w-4xl max-h-[90vh] min-h-0 overflow-hidden rounded-2xl flex flex-col shadow-2xl border ${theme === 'light' ? 'bg-white border-gray-200' : 'bg-slate-900 border-white/10'
                }`}>

                {/* Header with Save button */}
                <div className={`flex items-center justify-between p-4 border-b shrink-0 ${theme === 'light' ? 'bg-gray-50/80 border-gray-200' : 'bg-white/5 border-white/10'
                    }`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner ${theme === 'light' ? 'bg-amber-100 text-amber-600' : 'bg-amber-500/20 text-amber-400'
                            }`}>
                            <Shield className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className={`font-bold text-lg ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>صلاحيات الحقول</h2>
                            <p className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-white/60'}`}>
                                تحديد مستوى الصلاحية المطلوب لتعديل كل حقل مالي (1 للمالية، 2 للموارد البشرية، الخ..)
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={handleSave}
                            disabled={saving || loading}
                            className="px-5 py-2 bg-brand-green hover:bg-brand-green/90 text-white rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-brand-green/20 disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            حفظ
                        </button>
                        <button
                            onClick={onClose}
                            className={`p-2 rounded-lg transition-colors ${theme === 'light' ? 'hover:bg-gray-200 text-gray-500' : 'hover:bg-white/10 text-white/60'
                                }`}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto min-h-0 p-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-48 space-y-4">
                            <Loader2 className={`w-8 h-8 animate-spin ${theme === 'light' ? 'text-brand-green' : 'text-brand-green'}`} />
                            <p className={theme === 'light' ? 'text-gray-500' : 'text-white/60'}>جاري تحميل الصلاحيات...</p>
                        </div>
                    ) : (
                        <div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {allFields.map(field => {
                                const perm = permissions.find(p => p.column_name === field.key) || { permission_levels: defaultLevelsFor(field.key) };
                                return (
                                    <div key={field.key} className={`flex items-center justify-between p-3 rounded-lg border ${theme === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-white/5 border-white/10'
                                        }`}>
                                        <div className="flex-1">
                                            <p className={`font-semibold text-sm ${theme === 'light' ? 'text-gray-800' : 'text-white'}`}>
                                                {field.label}
                                            </p>
                                            <p className={`text-[10px] font-mono mt-1 ${theme === 'light' ? 'text-gray-400' : 'text-white/40'}`}>
                                                {field.key}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0" dir="ltr">
                                            {[1, 2, 3, 4].map(level => {
                                                const labels = ["مالية", "موارد بشرية", "إعلام", "عام"];
                                                const label = labels[level - 1];
                                                const isActive = perm.permission_levels?.includes(level);

                                                return (
                                                    <button
                                                        key={level}
                                                        onClick={() => handleLevelToggle(field.key, level)}
                                                        title={`مستوى ${level} - ${label}`}
                                                        className={`px-3 h-8 rounded text-xs font-bold transition-all flex items-center justify-center whitespace-nowrap ${isActive
                                                            ? 'bg-brand-green text-white shadow-md'
                                                            : theme === 'light'
                                                                ? 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-100'
                                                                : 'bg-zinc-800 text-white/50 border border-white/10 hover:bg-zinc-700'
                                                            }`}
                                                    >
                                                        {label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* --- المنح الفردي: تطوير محاكي بناء شبكة FTTH --- */}
                        <div className={`mt-2 mb-6 p-4 rounded-xl border ${theme === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-white/5 border-white/10'}`}>
                            <div className="flex items-center gap-3 mb-3">
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${theme === 'light' ? 'bg-brand-green/10 text-brand-green' : 'bg-brand-green/20 text-brand-green'}`}>
                                    <UserPlus className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className={`font-bold text-sm ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                                        منح فردي — تطوير محاكي بناء شبكة FTTH
                                    </p>
                                    <p className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-white/60'}`}>
                                        إضافة مستخدم محدد (ضمن المستويات أو خارجها) دون منح كامل مستواه
                                    </p>
                                </div>
                            </div>

                            <EmployeeSearch
                                value={ftthSearchValue}
                                onChange={setFtthSearchValue}
                                onSelect={handleAddFtthUser}
                                placeholder="ابحث بالاسم أو الرقم الوظيفي أو اسم المستخدم..."
                                searchUsername
                                includeRole
                                portalClassName="z-[100000]"
                            />

                            {ftthUsers.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {ftthUsers.map(u => (
                                        <span
                                            key={u.user_id}
                                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${theme === 'light'
                                                ? 'bg-brand-green/10 text-brand-green border-brand-green/20'
                                                : 'bg-brand-green/15 text-emerald-300 border-brand-green/30'
                                                }`}
                                        >
                                            {u.full_name}
                                            {u.job_number && <span className="font-mono opacity-70">({u.job_number})</span>}
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveFtthUser(u.user_id)}
                                                className="hover:text-red-500 transition-colors"
                                                title="إزالة المنح الفردي"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};
