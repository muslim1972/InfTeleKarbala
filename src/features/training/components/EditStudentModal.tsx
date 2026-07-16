import React, { useState } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';
import { cn } from '../../../lib/utils';
import type { TrainingStudent } from '../types';
import { useTheme } from '../../../context/ThemeContext';

interface EditStudentModalProps {
    student: TrainingStudent;
    onClose: () => void;
    onUpdate: (updatedStudent: TrainingStudent) => void;
}

export const EditStudentModal: React.FC<EditStudentModalProps> = ({ student, onClose, onUpdate }) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [formData, setFormData] = useState({
        full_name: student.full_name || '',
        password: '',
        institution_name: student.institution_name || '',
        training_location: student.training_location || '',
        trainer_name: student.trainer_name || ''
    });

    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.full_name || !formData.institution_name) {
            toast.error('يرجى تعبئة الحقول الأساسية');
            return;
        }

        setLoading(true);

        try {
            // Generate username automatically from full_name if needed
            // But since the user might just be correcting a typo, we should also update the username to reflect the new full name
            const usernameParts = formData.full_name.trim().split(' ');
            const newUsername = usernameParts.slice(0, 3).join(' ');

            const updatePayload: any = {
                full_name: formData.full_name.trim(),
                username: newUsername,
                institution_name: formData.institution_name.trim(),
                training_location: formData.training_location.trim(),
                trainer_name: formData.trainer_name.trim()
            };

            if (formData.password) {
                const { data: newHash, error: hashErr } = await supabase.rpc('hash_password', { password: formData.password.trim() });
                if (hashErr) throw new Error("فشل تشفير كلمة المرور: " + hashErr.message);
                updatePayload.password_hash = newHash;
            }

            const { data, error } = await supabase
                .from('summer_training_students')
                .update(updatePayload)
                .eq('id', student.id)
                .select()
                .single();

            if (error) {
                if (error.code === '23505') { // Unique violation for username
                    toast.error('اسم المستخدم (الاسم الثلاثي) موجود مسبقاً لطالب آخر');
                } else {
                    throw error;
                }
                return;
            }

            toast.success('تم تحديث بيانات الطالب بنجاح');
            onUpdate(data as TrainingStudent);
        } catch (error: any) {
            console.error('Error updating student:', error);
            toast.error(error.message || 'حدث خطأ أثناء تحديث البيانات');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className={cn(
                "relative w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200",
                isDark ? 'bg-zinc-900 text-white border border-white/10' : 'bg-white text-slate-900 border border-slate-200'
            )}>
                {/* Header */}
                <div className={cn("p-4 border-b flex items-center justify-between", isDark ? "border-white/10" : "border-slate-100")}>
                    <h2 className="text-lg font-bold">تعديل بيانات الطالب</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-red-500/10 text-red-400 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-4 overflow-y-auto custom-scrollbar space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-bold block">الاسم الثلاثي أو الرباعي <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            required
                            value={formData.full_name}
                            onChange={e => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                            className={cn(
                                "w-full px-3 py-2.5 rounded-xl border text-sm transition-colors",
                                isDark ? "bg-black/20 border-white/10 focus:border-emerald-500/50" : "bg-slate-50 border-slate-200 focus:border-emerald-500"
                            )}
                            placeholder="الاسم الثلاثي أو الرباعي"
                        />
                        <p className={cn("text-[11px]", isDark ? "text-white/40" : "text-slate-500")}>
                            ملاحظة: سيتم توليد اسم المستخدم تلقائياً من أول 3 مقاطع من الاسم.
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-bold block">كلمة المرور (الرمز)</label>
                        <input
                            type="text"
                            value={formData.password}
                            onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                            className={cn(
                                "w-full px-3 py-2.5 rounded-xl border text-sm transition-colors",
                                isDark ? "bg-black/20 border-white/10 focus:border-emerald-500/50" : "bg-slate-50 border-slate-200 focus:border-emerald-500"
                            )}
                            placeholder="اتركه فارغاً للاحتفاظ بكلمة المرور الحالية"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-bold block">اسم المؤسسة (الجامعة/المعهد/الإعدادية) <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            required
                            value={formData.institution_name}
                            onChange={e => setFormData(prev => ({ ...prev, institution_name: e.target.value }))}
                            className={cn(
                                "w-full px-3 py-2.5 rounded-xl border text-sm transition-colors",
                                isDark ? "bg-black/20 border-white/10 focus:border-emerald-500/50" : "bg-slate-50 border-slate-200 focus:border-emerald-500"
                            )}
                            placeholder="مثال: جامعة كربلاء / كلية الهندسة"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-bold block">موقع التدريب</label>
                        <input
                            type="text"
                            value={formData.training_location}
                            onChange={e => setFormData(prev => ({ ...prev, training_location: e.target.value }))}
                            className={cn(
                                "w-full px-3 py-2.5 rounded-xl border text-sm transition-colors",
                                isDark ? "bg-black/20 border-white/10 focus:border-emerald-500/50" : "bg-slate-50 border-slate-200 focus:border-emerald-500"
                            )}
                            placeholder="مثال: قسم تجهيز خدمات المعلوماتية"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-bold block">اسم المدرب</label>
                        <input
                            type="text"
                            value={formData.trainer_name}
                            onChange={e => setFormData(prev => ({ ...prev, trainer_name: e.target.value }))}
                            className={cn(
                                "w-full px-3 py-2.5 rounded-xl border text-sm transition-colors",
                                isDark ? "bg-black/20 border-white/10 focus:border-emerald-500/50" : "bg-slate-50 border-slate-200 focus:border-emerald-500"
                            )}
                            placeholder="اسم المدرب المشرف"
                        />
                    </div>

                    <div className="pt-4 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className={cn(
                                "px-4 py-2 rounded-xl text-sm font-bold transition-colors",
                                isDark ? "bg-white/5 hover:bg-white/10" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                            )}
                        >
                            إلغاء
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm rounded-xl transition-all flex items-center gap-2"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            حفظ التعديلات
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
