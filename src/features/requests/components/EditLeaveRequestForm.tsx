import React, { useState, useEffect } from 'react';
import { FileText, AlertCircle, Scissors } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { DateInput } from '../../../components/ui/DateInput';

interface EditLeaveRequestFormProps {
    request: any;
    onSuccess: () => void;
    onCancelEdit: () => void;
}

const EditLeaveRequestForm: React.FC<EditLeaveRequestFormProps> = ({ request, onSuccess, onCancelEdit }) => {
    const [formData, setFormData] = useState({
        startDate: request.start_date,
        daysCount: request.days_count,
    });
    const [cutDate, setCutDate] = useState('');

    const [endDate, setEndDate] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const today = new Date().toISOString().split('T')[0];
    const isBeforeStart = today < request.start_date;
    const isAfterStartButBeforeEnd = today >= request.start_date && today <= request.end_date;
    
    // إذا كان الموظف قد ألغى الإجازة في أول يوم لها (نادرة الحدوث) فسيقوم بقطعها بمدة صفر، وهذا تتم معالجته في الكود

    useEffect(() => {
        if (formData.startDate && formData.daysCount > 0) {
            const start = new Date(formData.startDate);
            const end = new Date(start);
            end.setDate(start.getDate() + formData.daysCount);
            
            // Auto-adjust: skip Fridays and holidays (Saturday remains as-is for rejection)
            const holidays = [
              { m: 1, d: 1 }, { m: 1, d: 6 },
              { m: 3, d: 16 }, { m: 3, d: 21 },
              { m: 5, d: 1 }
            ];

            let adjusted = true;
            while (adjusted) {
              adjusted = false;
              const day = end.getDay(); // 0=Sun .. 5=Fri 6=Sat
              const month = end.getMonth() + 1;
              const dayOfMonth = end.getDate();

              // If it's Friday (5) or Saturday (6), advance one day and check again
              if (day === 5 || day === 6) {
                end.setDate(end.getDate() + 1);
                adjusted = true;
              } 
              // If it's a holiday, advance one day and check again
              else if (holidays.some(h => h.m === month && h.d === dayOfMonth)) {
                end.setDate(end.getDate() + 1);
                adjusted = true;
              }
            }

            setEndDate(end.toISOString().split('T')[0]);
        } else {
            setEndDate('');
        }
    }, [formData.startDate, formData.daysCount]);

    const handleModify = async (type: 'edited' | 'canceled' | 'cut') => {
        setIsSubmitting(true);
        setError(null);
        try {
            let params: any = {
                p_request_id: request.id,
                p_modification_type: type,
            };

            if (type === 'edited') {
                params.p_start_date = formData.startDate;
                params.p_days_count = formData.daysCount;
                params.p_end_date = endDate;
            } else if (type === 'cut') {
                if (!cutDate) {
                    throw new Error('يرجى تحديد تاريخ المباشرة');
                }
                params.p_cut_date = cutDate;
            }

            const { data, error: rpcError } = await supabase.rpc('modify_leave_request', params);

            if (rpcError) throw rpcError;

            // إعادة توجيه طلب الإلغاء للمدير الأول في السلسلة
            if (type === 'canceled' && request.approval_chain && request.approval_chain.length > 0) {
                await supabase.from('leave_requests').update({
                    current_approval_step: 1,
                    supervisor_id: request.approval_chain[0]
                }).eq('id', request.id);
            }

            const response = data as any;
            if (!response || !response.success) {
                throw new Error(response?.message || 'فشلت عملية التعديل');
            }

            onSuccess();
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'حدث خطأ أثناء التعديل');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    {isBeforeStart ? (
                        <><FileText className="text-blue-600" size={24} /> تعديل أو إلغاء الطلب</>
                    ) : (
                        <><Scissors className="text-green-600" size={24} /> قطع الإجازة</>
                    )}
                </h2>
                <button onClick={onCancelEdit} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                    إغلاق
                </button>
            </div>

            {error && (
                <div className="p-3 mb-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
                    <AlertCircle size={16} />
                    {error}
                </div>
            )}

            {isBeforeStart ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">تاريخ البداية الجديد</label>
                            <DateInput
                                value={formData.startDate}
                                onChange={(val) => setFormData({ ...formData, startDate: val })}
                                className="w-full bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 rounded-xl py-3"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">عدد الأيام الجديد</label>
                            <input
                                type="number"
                                min="1"
                                value={formData.daysCount}
                                onChange={(e) => setFormData({ ...formData, daysCount: parseInt(e.target.value) || 0 })}
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => handleModify('edited')}
                            disabled={isSubmitting}
                            className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition disabled:opacity-70"
                        >
                            حفظ التعديلات وإرسال
                        </button>
                        <button
                            onClick={() => handleModify('canceled')}
                            disabled={isSubmitting}
                            className="flex-1 bg-red-50 text-red-600 font-bold py-3 rounded-xl border border-red-200 hover:bg-red-100 transition disabled:opacity-70"
                        >
                            إلغاء الطلب نهائياً
                        </button>
                    </div>
                </div>
            ) : isAfterStartButBeforeEnd ? (() => {
                let actualDays = 0;
                let returnedDays = 0;
                if (cutDate && request.start_date) {
                    const start = new Date(request.start_date);
                    const cut = new Date(cutDate);
                    actualDays = Math.ceil((cut.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                    if (actualDays < 0) actualDays = 0;
                    if (actualDays > request.days_count) actualDays = request.days_count;
                    returnedDays = request.days_count - actualDays;
                }

                return (
                    <div className="space-y-6">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/50">
                            <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-2">تفاصيل الإجازة الأصلية</h4>
                            <p className="text-xs text-blue-700/80 dark:text-blue-400">من <span className="font-mono">{request.start_date}</span> إلى <span className="font-mono">{request.end_date}</span> (المدة: {request.days_count} يوم)</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">تاريخ المباشرة (قطع الإجازة)</label>
                            <DateInput
                                value={cutDate}
                                onChange={setCutDate}
                                className="w-full bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 rounded-xl py-3"
                            />
                        </div>
                        
                        {cutDate && (
                            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-200 dark:border-amber-800/50 space-y-2">
                                <p className="text-sm text-amber-800 dark:text-amber-300">
                                    <span className="font-bold">الأيام الفعلية التي تمتعت بها:</span> {actualDays} يوم
                                </p>
                                <p className="text-sm text-amber-800 dark:text-amber-300">
                                    <span className="font-bold">سيتم إرجاع لرصيدك:</span> {returnedDays} يوم
                                </p>
                            </div>
                        )}

                        <button
                            onClick={() => handleModify('cut')}
                            disabled={isSubmitting || !cutDate}
                            className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition disabled:opacity-70 flex items-center justify-center gap-2"
                        >
                            إرسال طلب قطع الإجازة
                        </button>
                    </div>
                );
            })() : (
                <div className="text-center text-gray-500 py-4">
                    لا يمكن تعديل هذه الإجازة في الوقت الحالي.
                </div>
            )}
        </div>
    );
};

export default EditLeaveRequestForm;
