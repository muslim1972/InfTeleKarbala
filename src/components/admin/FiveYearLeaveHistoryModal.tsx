import React from 'react';
import { X, Clock, FileText } from 'lucide-react';

interface FiveYearLeaveHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    leave: any;
}

export const FiveYearLeaveHistoryModal: React.FC<FiveYearLeaveHistoryModalProps> = ({
    isOpen,
    onClose,
    leave
}) => {
    if (!isOpen || !leave) return null;

    const history = Array.isArray(leave.modification_history) ? leave.modification_history : [];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-hidden">
            <div className="bg-white dark:bg-zinc-900 border border-border dark:border-white/10 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl mt-10">
                {/* Header */}
                <div className="p-4 border-b border-border dark:border-white/10 flex items-center justify-between bg-muted/50 dark:bg-white/5">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-foreground dark:text-white">
                        <Clock className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                        سجل حركات الإجازة
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 bg-black/5 dark:bg-white/5 rounded-full" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
                    {/* Basic Entry Info */}
                    <div className="bg-muted/30 dark:bg-white/5 border border-border dark:border-white/10 rounded-xl p-4">
                        <h4 className="font-bold mb-3 flex items-center gap-2 text-foreground dark:text-white">
                            <FileText className="w-4 h-4 text-muted-foreground" />
                            بيانات الإدخال الأصلية
                        </h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-muted-foreground block mb-1">رقم الأمر</span>
                                <span className="font-medium text-foreground dark:text-white">{leave.order_number || 'غير متوفر'}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground block mb-1">تاريخ الأمر</span>
                                <span className="font-medium text-foreground dark:text-white">{leave.order_date || 'غير متوفر'}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground block mb-1">تاريخ الانفكاك</span>
                                <span className="font-medium text-foreground dark:text-white">{leave.start_date || 'غير متوفر'}</span>
                            </div>
                            <div className="col-span-2 mt-2 pt-2 border-t border-border dark:border-white/10 grid grid-cols-2 gap-4">
                                <div>
                                    <span className="text-muted-foreground block mb-1">تاريخ الإنشاء</span>
                                    <span className="font-medium text-foreground dark:text-white" dir="ltr">
                                        {new Date(leave.created_at).toLocaleString('ar-IQ')}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block mb-1">أنشئت الإجازة بواسطة</span>
                                    <span className="font-medium text-foreground dark:text-white">
                                        {leave.created_by_name || 'غير متوفر'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Modification History */}
                    {history.length > 0 && (
                        <div>
                            <h4 className="font-bold mb-3 text-foreground dark:text-white">سجل التعديلات</h4>
                            <div className="space-y-3">
                                {history.map((entry: any, index: number) => (
                                    <div key={index} className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl p-4 text-sm">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-bold text-blue-800 dark:text-blue-300">{entry.modified_by_name || 'غير متوفر'}</span>
                                            <span className="text-xs text-blue-600 dark:text-blue-400" dir="ltr">
                                                {new Date(entry.modified_at).toLocaleString('ar-IQ')}
                                            </span>
                                        </div>
                                        <div className="text-muted-foreground space-y-1 mt-2 border-t border-blue-100 dark:border-blue-900/30 pt-2">
                                            <p>تعديل بيانات الإجازة.</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Cancellation Info */}
                    {leave.status === 'canceled' && (
                        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-4 text-sm mt-6">
                            <h4 className="font-bold text-red-800 dark:text-red-300 mb-2 border-b border-red-200/50 pb-2">تفاصيل الإلغاء</h4>
                            <div className="grid grid-cols-1 gap-4">
                                <div className="text-center bg-white/50 dark:bg-black/20 p-3 rounded-lg border border-red-100 dark:border-red-900/50">
                                    <span className="text-muted-foreground block mb-1 text-xs uppercase tracking-wider">سبب الإلغاء</span>
                                    <span className="font-bold text-foreground dark:text-white text-lg">{leave.cancel_reason}</span>
                                </div>
                                <div className="pt-3 border-t border-red-200/50 mt-1 grid grid-cols-2 gap-4">
                                    <div>
                                        <span className="text-muted-foreground block mb-1">تاريخ الإلغاء</span>
                                        <span className="font-medium text-foreground dark:text-white">{leave.cancel_date}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground block mb-1">أُلغيت بواسطة</span>
                                        <span className="font-medium text-foreground dark:text-white">{leave.canceled_by_name}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {history.length === 0 && leave.status !== 'canceled' && (
                        <div className="text-center p-4 text-muted-foreground text-sm bg-muted/30 dark:bg-white/5 rounded-xl">
                            لا توجد تعديلات سابقة على هذه الإجازة.
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-border dark:border-white/10 bg-muted/30 dark:bg-white/5 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 rounded-lg transition-colors font-medium text-foreground dark:text-white"
                    >
                        إغلاق
                    </button>
                </div>
            </div>
        </div>
    );
};
