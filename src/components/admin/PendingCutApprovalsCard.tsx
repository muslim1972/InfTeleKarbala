import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { CheckCircle, Loader2, ChevronDown, ChevronUp, User, X, AlertCircle } from 'lucide-react';
import type { LeaveRecord } from './AdminLeaveRequests';
import { LeaveTypeBadge } from './LeaveTypeBadge';

interface PendingCutApprovalsCardProps {
    records: LeaveRecord[];
    isLoading: boolean;
    onRefresh: () => void;
    activeHighlightId: string | null;
    isExpanded: boolean;
    onToggle: () => void;
}

export function PendingCutApprovalsCard({
    records,
    isLoading,
    onRefresh,
    activeHighlightId,
    isExpanded,
    onToggle
}: PendingCutApprovalsCardProps) {
    const [selectedRequest, setSelectedRequest] = useState<LeaveRecord | null>(null);
    const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
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
            <button
                onClick={onToggle}
                className="w-full flex justify-between items-center mb-6 sticky top-20 z-20 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-gray-100/50 dark:border-slate-700/50 focus:outline-none"
            >
                <div className="flex-1 text-right">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <CheckCircle className="text-amber-500" />
                        طلبات قطع الإجازة (بانتظار اعتماد الموارد البشرية)
                        {records.length > 0 && (
                            <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-xs font-bold px-2 py-0.5 rounded-full mr-2">
                                {records.length}
                            </span>
                        )}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1 text-right">
                        طلبات قطع تمت الموافقة عليها من قبل المسؤول المباشر وتحتاج إلى اعتمادك لإرجاع الرصيد.
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div
                        onClick={(e) => {
                            e.stopPropagation();
                            onRefresh();
                        }}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-bold"
                    >
                        تحديث
                    </div>
                    <div className="p-2 bg-gray-100 dark:bg-slate-700 rounded-full text-gray-600 dark:text-gray-300">
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                </div>
            </button>

            {isExpanded && (
                <div className="animate-in slide-in-from-top-4 duration-300">

            {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-amber-500" size={28} /></div>
            ) : records.length > 0 ? (
                <div className="flex flex-col gap-3">
                    {records.map(record => {
                        const nameParts = record.employee_name ? record.employee_name.split(' ').slice(0, 2).join(' ') : 'غير معروف';
                        const typeLabel = record.leave_type === 'long_regular' ? 'اعتيادية طويلة' : record.leave_type === 'long_sick' ? 'مرضية طويلة' : record.leave_type === 'sick' ? 'مرضية' : record.leave_type === 'regular' ? 'اعتيادية' : record.leave_type === 'time_off' ? 'زمنية' : '';
                        const isItemExpanded = expandedRequestId === record.id;

                        return (
                            <div 
                                key={record.id} 
                                id={`request-${record.id}`}
                                className={`bg-white dark:bg-slate-900 border rounded-xl overflow-hidden transition-all duration-300 shadow-sm hover:shadow-md ${isItemExpanded ? 'border-amber-200 dark:border-amber-800 ring-1 ring-amber-500/20' : 'border-gray-200 dark:border-slate-700 cursor-pointer'} ${record.id === activeHighlightId ? 'highlight-request' : ''}`}
                            >
                                {/* Thin Bar (Collapsed View) */}
                                <div 
                                    onClick={() => setExpandedRequestId(isItemExpanded ? null : record.id)}
                                    className={`flex items-center justify-between p-3 ${isItemExpanded ? 'bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700/50' : 'cursor-pointer'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                                            <User size={16} className="text-amber-600 dark:text-amber-400" />
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-bold text-sm">{nameParts}</span>
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-900/20 dark:border-amber-800/50">طلب قطع إجازة {typeLabel ? `(${typeLabel})` : ''}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs px-2 py-1 rounded-md bg-amber-100 text-amber-700 font-bold flex items-center gap-1 border border-amber-200">
                                            بانتظار الاعتماد
                                        </span>
                                    </div>
                                </div>

                                {/* Expanded Content */}
                                {isItemExpanded && (
                                    <div className="p-4 animate-in slide-in-from-top-2 duration-200 bg-gray-50/50 dark:bg-slate-900/50">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                                                    <User size={20} className="text-amber-600 dark:text-amber-400" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-base text-gray-900 dark:text-white">{record.employee_name}</p>
                                                    {record.employee_job_number && (
                                                        <p className="text-[12px] text-gray-500 font-mono">{record.employee_job_number}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <LeaveTypeBadge type={record.leave_type} cancellationStatus={record.cancellation_status} />
                                            </div>
                                        </div>
                                        <div className="space-y-1 text-sm bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-100 dark:border-slate-700 mb-4">
                                            <p>الإجازة الأصلية: من <span className="font-bold dir-ltr inline-block font-mono">{record.start_date}</span> إلى <span className="font-bold dir-ltr inline-block font-mono">{record.end_date}</span></p>
                                            
                                            {record.leave_type === 'time_off' ? (
                                                <p className="text-gray-500">المدة الكلية: <span className="font-bold text-teal-600">{record.time_duration_minutes} دقيقة</span></p>
                                            ) : (
                                                <p className="text-gray-500">المدة الكلية: <span className="font-bold">{record.days_count} يوم</span></p>
                                            )}

                                            {record.destination && (
                                                <p className="text-gray-500 text-xs mt-1">الوجهة: <span className="font-bold text-purple-700 dark:text-purple-400">{record.destination}</span></p>
                                            )}

                                            <p className="text-rose-600 dark:text-rose-400 font-bold mt-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                                                تاريخ المباشرة (القطع): <span className="font-mono">{record.cut_date || 'غير محدد'}</span>
                                            </p>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <button
                                                onClick={() => setSelectedRequest(record)}
                                                className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl text-sm font-bold flex justify-center items-center gap-2 transition shadow-md"
                                            >
                                                معالجة واعتماد القطع
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
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
            )}
        </div>
    );
}
