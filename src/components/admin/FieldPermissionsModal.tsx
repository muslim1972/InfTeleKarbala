import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { toast } from "react-hot-toast";
import { X, Shield, Save, Loader2 } from "lucide-react";

interface FieldPermissionsModalProps {
    onClose: () => void;
    theme: string;
}

interface FieldPermission {
    column_name: string;
    permission_level: number;
}

export const FieldPermissionsModal = ({ onClose, theme }: FieldPermissionsModalProps) => {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [permissions, setPermissions] = useState<FieldPermission[]>([]);

    // Define the static list of all fields
    const allFields = [
        // --- الأساسية والحسابات ---
        { key: 'full_name', label: 'الاسم الكامل' },
        { key: 'username', label: 'اسم المستخدم' },
        { key: 'password', label: 'كلمة المرور' },
        { key: 'role', label: 'نوع الحساب (مشرف/موظف)' },
        { key: 'job_number', label: 'الرقم الوظيفي الموحد' },
        { key: 'iban', label: 'رمز ( IBAN )' },
        { key: 'first_hire_date', label: 'تاريخ اول تعيين' },
        // --- السجلات الإدارية ---
        { key: 'thanks', label: 'سجلات: كتب الشكر' },
        { key: 'committees', label: 'سجلات: اللجان' },
        { key: 'penalties', label: 'سجلات: العقوبات' },
        { key: 'leaves', label: 'سجلات: الاجازات' },
        // --- تبويبات النظام ---
        { key: 'tab_supervisors', label: 'تبويبة المشرفون' },
        { key: 'tab_training', label: 'تبويبة التدريب الصيفي' },
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

    const fetchPermissions = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('field_permissions')
                .select('*');

            if (error) {
                // If table doesn't exist yet, we'll catch it here and just use defaults
                console.error("Error fetching permissions (ensure SQL script is run):", error);

                // Set default permissions (everyone level 4)
                const defaultPerms = allFields.map(f => ({
                    column_name: f.key,
                    permission_level: 4
                }));
                setPermissions(defaultPerms);
                return;
            }

            // Merge fetched permissions with all fields list, defaulting missing to level 4
            const mergedPerms = allFields.map(field => {
                const found = data?.find(p => p.column_name === field.key);
                return {
                    column_name: field.key,
                    permission_level: found ? found.permission_level : 4
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
    }, []);

    const handleLevelChange = (columnName: string, level: number) => {
        setPermissions(prev => prev.map(p =>
            p.column_name === columnName ? { ...p, permission_level: level } : p
        ));
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
                        permission_level: p.permission_level,
                        updated_at: new Date().toISOString()
                    }))
                );

            if (error) throw error;
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

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className={`relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl flex flex-col shadow-2xl border ${theme === 'light' ? 'bg-white border-gray-200' : 'bg-slate-900 border-white/10'
                }`}>

                {/* Header */}
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
                                تحديد مستوى الصلاحية المطلوب لتعديل كل حقل مالي (1 للمالية، 2 للذاتية، الخ..)
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className={`p-2 rounded-lg transition-colors ${theme === 'light' ? 'hover:bg-gray-200 text-gray-500' : 'hover:bg-white/10 text-white/60'
                            }`}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-48 space-y-4">
                            <Loader2 className={`w-8 h-8 animate-spin ${theme === 'light' ? 'text-brand-green' : 'text-brand-green'}`} />
                            <p className={theme === 'light' ? 'text-gray-500' : 'text-white/60'}>جاري تحميل الصلاحيات...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {allFields.map(field => {
                                const perm = permissions.find(p => p.column_name === field.key) || { permission_level: 4 };
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
                                                const labels = ["مالية", "ذاتية", "إعلام", "عام"];
                                                const label = labels[level - 1];
                                                const isActive = perm.permission_level === level;

                                                return (
                                                    <button
                                                        key={level}
                                                        onClick={() => handleLevelChange(field.key, level)}
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
                    )}
                </div>

                {/* Footer */}
                <div className={`p-4 border-t flex justify-end gap-3 shrink-0 ${theme === 'light' ? 'bg-gray-50/80 border-gray-200' : 'bg-white/5 border-white/10'
                    }`}>
                    <button
                        onClick={onClose}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${theme === 'light' ? 'bg-gray-200 hover:bg-gray-300 text-gray-700' : 'bg-white/10 hover:bg-white/20 text-white'
                            }`}
                    >
                        إلغاء
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="px-6 py-2 bg-brand-green hover:bg-brand-green/90 text-white rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-brand-green/20 disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        حفظ التغييرات
                    </button>
                </div>
            </div>
        </div>
    );
};
