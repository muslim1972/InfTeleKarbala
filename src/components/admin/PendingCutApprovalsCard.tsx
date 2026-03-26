
import { supabase } from '../../lib/supabase';
import { Loader2, CheckCircle, User } from 'lucide-react';
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
    return (
        <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-md rounded-3xl p-6 shadow-xl border border-gray-100 dark:border-slate-700 animate-in fade-in duration-500 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-2 h-full bg-amber-500"></div>
            <div className="flex justify-between items-center mb-6">
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
                                    onClick={() => {
                                        const actualDaysStr = window.prompt(`الموظف (${record.employee_name}) قَطَع إجازته بتاريخ ${record.cut_date}.\nكم عدد الأيام الفعلية التي تمتع بها قبل القطع؟\n\n(مثلاً إذا قطعها بعد يومين، أدخل: 2. سيتم إعادة الباقي لرصيده)`, "0");
                                        if (actualDaysStr !== null) {
                                            const actualDays = parseInt(actualDaysStr, 10);
                                            if (isNaN(actualDays) || actualDays < 0 || actualDays > record.days_count) {
                                                alert("يرجى إدخال عدد أيام صحيح (أقل من أو يساوي الإجازة الأصلية).");
                                            } else {
                                                if (window.confirm(`هل أنت متأكد أن الأيام الفعلية هي ${actualDays} أيام؟\nسيتم إرجاع ${record.days_count - actualDays} يوم للموظف.`)) {
                                                    const processCut = async () => {
                                                        try {
                                                            const { data, error } = await supabase.rpc('process_hr_leave_cut', {
                                                                p_request_id: record.id,
                                                                p_actual_days: actualDays
                                                            });
                                                            if (error) throw error;
                                                            alert((data as any).message);
                                                            onRefresh();
                                                        } catch (err: any) {
                                                            alert("حدث خطأ أثناء اعتماد القطع: " + err.message);
                                                        }
                                                    };
                                                    processCut();
                                                }
                                            }
                                        }
                                    }}
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
        </div>
    );
}
