import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, CheckCircle, User, X, AlertCircle } from 'lucide-react';
import type { LeaveRecord } from './AdminLeaveRequests';

interface PendingCutApprovalsCardProps {
    records: LeaveRecord[];
    isLoading: boolean;
    onRefresh: () => void;
    activeHighlightId: string | null;
}

export function PendingCutApprovalsCard({
    records,
    isLoading,
    onRefresh,
    activeHighlightId
}: PendingCutApprovalsCardProps) {
    const [selectedRequest, setSelectedRequest] = useState<LeaveRecord | null>(null);
    const [actualDays, setActualDays] = useState<number>(0);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (selectedRequest) {
            // Auto calculate initial suggested days based on cut date vs start date
            let suggested = 0;
            if (selectedRequest.cut_date && selectedRequest.start_date) {
                const start = new Date(selectedRequest.start_date);
                const cut = new Date(selectedRequest.cut_date);
                suggested = Math.ceil((cut.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                if (suggested < 0) suggested = 0;
                if (suggested > selectedRequest.days_count) suggested = selectedRequest.days_count;
            }
            setActualDays(suggested);
        }
    }, [selectedRequest]);

    const handleConfirmCut = async () => {
        if (!selectedRequest) return;
        if (isNaN(actualDays) || actualDays < 0 || actualDays > selectedRequest.days_count) {
            alert("يرجى إدخال عدد أيام صحيح (أقل من أو يساوي الإجازة الأصلية).");
            return;
        }

        setIsProcessing(true);
        try {
            const { error } = await supabase.rpc('process_hr_leave_cut', {
                p_request_id: selectedRequest.id,
                p_actual_days: actualDays
            });
            if (error) throw error;
            
            // Set is_read_by_employee = false to trigger the final notification
            await supabase.from('leave_requests').update({ is_read_by_employee: false }).eq('id', selectedRequest.id);
            
            setSelectedRequest(null);
            onRefresh();
        } catch (err: any) {
            alert("حدث خطأ أثناء اعتماد القطع: " + err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-md rounded-3xl p-6 shadow-xl border border-gray-100 dark:border-slate-700 animate-in fade-in duration-500 relative">
            <div className="absolute top-0 right-0 w-2 h-full bg-amber-500 rounded-r-3xl"></div>
            <div className="flex justify-between items-center mb-6 sticky top-20 z-20 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-gray-100/50 dark:border-slate-700/50">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <CheckCircle className="text-amber-500" />
                        طلبات قطع الإجازة (بانتظار اعتماد الموارد البشرية)
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        طلبات قطع تمت الموافقة عليها من قبل المسؤول المباشر وتحتاج إلى اعتمادك لإرجاع الرصيد.
                    </p>
                </div>
                <button
                    onClick={onRefresh}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-bold"
                >
                    تحديث
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-amber-500" size={28} /></div>
            ) : records.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {records.map(record => (
                        <div 
                            key={record.id} 
                            id={`request-${record.id}`}
                            className={`bg-gray-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-200 dark:border-slate-700 flex flex-col justify-between transition-all duration-500 ${record.id === activeHighlightId ? 'highlight-request' : ''}`}
                        >
                            <div>
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                            <User size={14} className="text-amber-600" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-gray-900 dark:text-white">{record.employee_name}</p>
                                            {record.employee_job_number && (
                                                <p className="text-[10px] text-gray-500 font-mono">{record.employee_job_number}</p>
                                            )}
                                        </div>
                                    </div>
                                    <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-bold ring-1 ring-amber-500/30">بانتظار اعتماد الموارد البشرية</span>
                                </div>
                                <div className="space-y-1 text-sm">
                                    <p>الإجازة الأصلية: من <span className="font-bold dir-ltr inline-block font-mono">{record.start_date}</span> إلى <span className="font-bold dir-ltr inline-block font-mono">{record.end_date}</span> (المدة: {record.days_count} يوم)</p>
                                    <p className="text-rose-600 dark:text-rose-400 font-bold">تاريخ المباشرة (القطع): <span className="font-mono">{record.cut_date || 'غير محدد'}</span></p>
                                </div>
                            </div>
                            <div className="mt-4 flex flex-col gap-2">
                                <button
                                    onClick={() => setSelectedRequest(record)}
                                    className="w-full bg-amber-500 hover:bg-amber-600 text-white py-2.5 rounded-lg text-sm font-bold flex justify-center items-center gap-2 transition shadow-md"
                                >
                                    اعتماد قطع الإجازة وإرجاع الرصيد
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-10 text-gray-500 bg-gray-50 dark:bg-slate-900/30 rounded-xl border border-dashed border-gray-300 dark:border-slate-700">
                    لا توجد طلبات قطع إجازة بانتظار اعتماد الموارد البشرية
                </div>
            )}

            {/* Custom Modal for HR Cut Approval */}
            {selectedRequest && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setSelectedRequest(null); }}>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-amber-500 p-4 text-white flex justify-between items-center">
                            <h3 className="font-bold text-lg">تأكيد اعتماد قطع الإجازة</h3>
                            <button onClick={() => setSelectedRequest(null)} className="hover:bg-white/20 p-1 rounded-xl transition">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-5">
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">{selectedRequest.employee_name}</h4>
                                <p className="text-sm text-slate-600 dark:text-slate-400">الإجازة الأصلية: {selectedRequest.days_count} يوم</p>
                                <p className="text-sm text-slate-600 dark:text-slate-400">من {selectedRequest.start_date} إلى {selectedRequest.end_date}</p>
                                <hr className="my-2 border-slate-200 dark:border-slate-700" />
                                <p className="text-sm font-bold text-rose-600 dark:text-rose-400">المباشرة: {selectedRequest.cut_date}</p>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                    الأيام الفعلية التي تمتع بها الموظف:
                                </label>
                                <input 
                                    type="number"
                                    min="0"
                                    max={selectedRequest.days_count}
                                    value={actualDays}
                                    onChange={(e) => setActualDays(parseInt(e.target.value) || 0)}
                                    className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
                                />
                            </div>

                            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-200 dark:border-amber-800/50 flex items-start gap-3">
                                <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={18} />
                                <p className="text-sm text-amber-800 dark:text-amber-300">
                                    بناءً على هذا الرقم، سيتم إرجاع <strong>{Math.max(0, selectedRequest.days_count - actualDays)}</strong> أيام إلى رصيد الموظف بشكل نهائي وتغلق الإجازة.
                                </p>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setSelectedRequest(null)}
                                    className="flex-1 py-3 text-slate-600 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                                >
                                    إلغاء
                                </button>
                                <button
                                    onClick={handleConfirmCut}
                                    disabled={isProcessing}
                                    className="flex-[2] py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2 disabled:opacity-70"
                                >
                                    {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                                    تأكيد وإرجاع الرصيد
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
