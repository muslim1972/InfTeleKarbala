import React, { useState, useEffect } from 'react';
import { X, Save, Ban, AlertTriangle, Calendar, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { DateInput } from '../ui/DateInput';

interface FiveYearLeaveDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    leave: any;
    financialData: any;
    onRefresh: () => void;
    currentUser: any;
}

export const FiveYearLeaveDetailsModal: React.FC<FiveYearLeaveDetailsModalProps> = ({
    isOpen,
    onClose,
    leave,
    financialData,
    onRefresh,
    currentUser
}) => {
    const [loading, setLoading] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [cancelMode, setCancelMode] = useState(false);

    // Form states
    const [formData, setFormData] = useState({
        order_number: '',
        order_date: '',
        start_date: '',
        end_date: ''
    });

    const [cancelData, setCancelData] = useState({
        cancel_date: new Date().toISOString().split('T')[0],
        cancel_reason: ''
    });

    useEffect(() => {
        if (leave && isOpen) {
            setFormData({
                order_number: leave.order_number || '',
                order_date: leave.order_date || '',
                start_date: leave.start_date || '',
                end_date: leave.end_date || ''
            });
            setEditMode(false);
            setCancelMode(false);
            setCancelData({
                cancel_date: new Date().toISOString().split('T')[0],
                cancel_reason: ''
            });
        }
    }, [leave, isOpen]);

    if (!isOpen || !leave) return null;

    const handleDateChange = (date: string) => {
        let returnDate = '';
        if (date) {
            const d = new Date(date);
            if (!isNaN(d.getTime())) {
                d.setFullYear(d.getFullYear() + 5);
                returnDate = d.toISOString().split('T')[0];
            }
        }
        setFormData({ ...formData, start_date: date, end_date: returnDate });
    };

    const handleSaveEdit = async () => {
        try {
            setLoading(true);

            // Record modification history
            const historyEntry = {
                modified_at: new Date().toISOString(),
                modified_by: currentUser?.id,
                modified_by_name: currentUser?.full_name,
                old_data: {
                    order_number: leave.order_number,
                    order_date: leave.order_date,
                    start_date: leave.start_date,
                    end_date: leave.end_date
                },
                new_data: formData
            };

            const existingHistory = Array.isArray(leave.modification_history) ? leave.modification_history : [];

            const { error: updateLeaveError } = await supabase
                .from('five_year_leaves')
                .update({
                    order_number: formData.order_number,
                    order_date: formData.order_date,
                    start_date: formData.start_date,
                    end_date: formData.end_date,
                    modification_history: [...existingHistory, historyEntry]
                })
                .eq('id', leave.id);

            if (updateLeaveError) throw updateLeaveError;

            // Update financial_records if this is the active leave
            if (leave.status === 'active' && financialData?.id) {
                const { error: updateFinError } = await supabase
                    .from('financial_records')
                    .update({
                        leave_start_date: formData.start_date,
                        leave_end_date: formData.end_date
                    })
                    .eq('id', financialData.id);
                if (updateFinError) throw updateFinError;
            }

            toast.success("تم تحديث بيانات الإجازة بنجاح");
            onRefresh();
            setEditMode(false);
            onClose();
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "حدث خطأ أثناء التحديث");
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmCancel = async () => {
        if (!cancelData.cancel_reason) {
            toast.error("يرجى اختيار سبب الإلغاء");
            return;
        }

        try {
            setLoading(true);

            // 1. Update five_year_leaves status
            const { error: leaveError } = await supabase
                .from('five_year_leaves')
                .update({
                    status: 'canceled',
                    cancel_date: cancelData.cancel_date,
                    cancel_reason: cancelData.cancel_reason,
                    canceled_by: currentUser?.id,
                    canceled_by_name: currentUser?.full_name
                })
                .eq('id', leave.id);

            if (leaveError) throw leaveError;

            // 2. Update financial_records to restore allowances
            if (financialData?.id) {
                const { error: finError } = await supabase
                    .from('financial_records')
                    .update({
                        is_five_year_leave: false,
                        // leave_start_date and end_date stay as history or can be cleared based on preferences, 
                        // but is_five_year_leave=false is enough to reactivate allowances.
                    })
                    .eq('id', financialData.id);

                if (finError) throw finError;
            }

            toast.success("تم إلغاء الإجازة بنجاح وإعادة المخصصات");
            onRefresh();
            onClose();

        } catch (e: any) {
            console.error(e);
            toast.error("حدث خطأ أثناء إلغاء الإجازة");
        } finally {
            setLoading(false);
        }
    };

    const isLeaveStarted = new Date(leave.start_date) <= new Date();

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-hidden">
            <div className="bg-white dark:bg-zinc-900 border border-border dark:border-white/10 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl mt-10">
                {/* Header */}
                <div className="p-4 border-b border-border dark:border-white/10 flex items-center justify-between bg-muted/50 dark:bg-white/5">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-foreground dark:text-white">
                        <FileText className="w-5 h-5 text-brand-green" />
                        تفاصيل إجازة الخمس سنوات
                        {leave.status === 'canceled' && (
                            <span className="text-sm bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-500/30">
                                ملغاة
                            </span>
                        )}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                    {cancelMode ? (
                        <div className="space-y-6 animate-in fade-in zoom-in-95">
                            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-4 flex gap-3 text-red-800 dark:text-red-300">
                                <AlertTriangle className="w-6 h-6 shrink-0" />
                                <div>
                                    <h4 className="font-bold mb-1">إلغاء الإجازة</h4>
                                    <p className="text-sm">سيتم إلغاء هذه الإجازة وإعادة تفعيل مخصصات الموظف في النظام المالي.</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>تاريخ الإلغاء/المباشرة</Label>
                                    <DateInput
                                        value={cancelData.cancel_date}
                                        onChange={(val) => setCancelData({ ...cancelData, cancel_date: val })}
                                        className="bg-muted dark:bg-black/20"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>سبب الإلغاء</Label>
                                    <Select
                                        value={cancelData.cancel_reason}
                                        onValueChange={(val) => setCancelData({ ...cancelData, cancel_reason: val })}
                                    >
                                        <SelectTrigger className="bg-muted dark:bg-black/20">
                                            <SelectValue placeholder="اختر سبب الإلغاء..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="خطأ في الإدخال">خطأ في الإدخال</SelectItem>
                                            {isLeaveStarted && <SelectItem value="قطع الإجازة والمباشرة">قطع الإجازة والمباشرة</SelectItem>}
                                            <SelectItem value="أخرى">أخرى</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-border dark:border-white/10">
                                <Button variant="outline" onClick={() => setCancelMode(false)}>تراجع</Button>
                                <Button
                                    onClick={handleConfirmCancel}
                                    disabled={loading || !cancelData.cancel_reason}
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                >
                                    تأكيد الإلغاء
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>رقم الأمر</Label>
                                    <Input
                                        type="text"
                                        value={formData.order_number}
                                        onChange={(e) => setFormData({ ...formData, order_number: e.target.value })}
                                        disabled={!editMode || leave.status === 'canceled'}
                                        className="bg-muted dark:bg-black/20"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>تاريخ الأمر</Label>
                                    <DateInput
                                        value={formData.order_date}
                                        onChange={(val) => setFormData({ ...formData, order_date: val })}
                                        disabled={!editMode || leave.status === 'canceled'}
                                        className="bg-muted dark:bg-black/20"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>تاريخ الانفكاك</Label>
                                    <DateInput
                                        value={formData.start_date}
                                        onChange={(val) => handleDateChange(val)}
                                        disabled={!editMode || leave.status === 'canceled'}
                                        className="bg-muted dark:bg-black/20"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4" />
                                        تاريخ المباشرة المتوقع
                                    </Label>
                                    <Input
                                        type="text"
                                        value={formData.end_date ? formData.end_date.split('-').reverse().join('/') : ""}
                                        readOnly
                                        disabled={!editMode || leave.status === 'canceled'}
                                        className="bg-black/5 dark:bg-white/5 cursor-not-allowed font-mono dir-ltr"
                                    />
                                </div>
                            </div>

                            {leave.status === 'canceled' && (
                                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-4 mt-6">
                                    <h4 className="font-bold text-red-800 dark:text-red-300 mb-2 border-b border-red-200/50 pb-2">معلومات الإلغاء</h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-muted-foreground block mb-1">تاريخ الإلغاء/المباشرة</span>
                                            <span className="font-medium text-foreground dark:text-white">{leave.cancel_date}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block mb-1">سبب الإلغاء</span>
                                            <span className="font-medium text-foreground dark:text-white">{leave.cancel_reason}</span>
                                        </div>
                                        <div className="col-span-2">
                                            <span className="text-muted-foreground block mb-1">بواسطة</span>
                                            <span className="font-medium text-foreground dark:text-white">{leave.canceled_by_name}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Modification History summary could go here if needed */}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                {!cancelMode && (
                    <div className="p-4 border-t border-border dark:border-white/10 flex justify-between bg-muted/30 dark:bg-white/5">
                        {leave.status === 'active' ? (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={() => setCancelMode(true)}
                                    className="text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-700 border-red-200"
                                >
                                    <Ban className="w-4 h-4 ml-2" />
                                    إلغاء الإجازة
                                </Button>

                                {editMode ? (
                                    <div className="flex gap-2">
                                        <Button variant="ghost" onClick={() => {
                                            setEditMode(false);
                                            // reset form to original
                                            setFormData({
                                                order_number: leave.order_number || '',
                                                order_date: leave.order_date || '',
                                                start_date: leave.start_date || '',
                                                end_date: leave.end_date || ''
                                            });
                                        }}>
                                            إلغاء التعديل
                                        </Button>
                                        <Button onClick={handleSaveEdit} disabled={loading} className="bg-brand-green hover:bg-brand-green/90 text-white">
                                            <Save className="w-4 h-4 ml-2" />
                                            حفظ التغييرات
                                        </Button>
                                    </div>
                                ) : (
                                    <Button onClick={() => setEditMode(true)} className="bg-brand-green hover:bg-brand-green/90 text-white">
                                        تعديل البيانات
                                    </Button>
                                )}
                            </>
                        ) : (
                            <div className="w-full flex justify-end">
                                <Button variant="outline" onClick={onClose}>إغلاق</Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
