import { supabase } from '../../lib/supabase';
import { Loader2, CheckCircle, User, Printer, Archive } from 'lucide-react';
import type { LeaveRecord } from './AdminLeaveRequests';

interface ApprovedRequestsCardProps {
    records: LeaveRecord[];
    isLoading: boolean;
    onRefresh: () => void;
    activeHighlightId: string | null;
    onPrint: (record: LeaveRecord) => void;
}

export function ApprovedRequestsCard({
    records,
    isLoading,
    onRefresh,
    activeHighlightId,
    onPrint
}: ApprovedRequestsCardProps) {
    return (
        <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-md rounded-3xl p-6 shadow-xl border border-gray-100 dark:border-slate-700 animate-in fade-in duration-500 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-2 h-full bg-green-500"></div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <CheckCircle className="text-green-500" />
                        طلبات الإجازة المعتمدة
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        جميع الطلبات التي تمت الموافقة عليها بانتظار الطباعة والمعالجة
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
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-green-500" size={28} /></div>
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
                                        <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                            <User size={14} className="text-green-600" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-gray-900 dark:text-white">{record.employee_name}</p>
                                            {record.employee_job_number && (
                                                <p className="text-[10px] text-gray-500 font-mono">{record.employee_job_number}</p>
                                            )}
                                        </div>
                                    </div>
                                    {record.cancellation_status === 'approved' ? (
                                        <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded text-xs font-bold ring-1 ring-rose-500/30">إجازة ملغاة</span>
                                    ) : (
                                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold ring-1 ring-green-500/30">معتمد</span>
                                    )}
                                </div>
                                <div className="space-y-1 text-sm">
                                    <p>من <span className="font-bold dir-ltr inline-block font-mono">{record.start_date}</span> إلى <span className="font-bold dir-ltr inline-block font-mono">{record.end_date}</span></p>
                                    <p className="text-gray-500">المدة: <span className="font-bold">{record.days_count} يوم</span> — المسؤول: <span className="font-bold">{record.supervisor?.full_name || '-'}</span></p>
                                    {(record.unpaid_days ?? 0) > 0 && (
                                        <p className="text-amber-600 dark:text-amber-400 font-bold text-xs mt-1">⚠️ ملاحظة: منها ({record.unpaid_days}) أيام كإجازة بدون راتب</p>
                                    )}
                                </div>
                            </div>
                            <div className="mt-4 flex flex-col gap-2">
                                {record.cancellation_status !== 'approved' && (
                                    <button
                                        onClick={() => onPrint(record)}
                                        className="w-full bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white py-2.5 rounded-lg text-sm font-bold flex justify-center items-center gap-2 transition shadow-md"
                                    >
                                        <Printer size={16} /> طباعة استمارة الإجازة PDF
                                    </button>
                                )}
                                <button
                                    onClick={async () => {
                                        if (window.confirm('هل أنت متأكد من حفظ (أرشفة) هذه الإجازة لتختفي من قائمة "بانتظار الطباعة"؟')) {
                                            const { error } = await supabase.from('leave_requests').update({ is_archived: true }).eq('id', record.id);
                                            if (!error) {
                                                onRefresh();
                                            } else {
                                                alert("حدث خطأ أثناء أرشفة الإجازة.");
                                            }
                                        }
                                    }}
                                    className="w-full bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-2.5 rounded-lg text-sm font-bold transition flex justify-center items-center gap-2"
                                >
                                    <Archive size={16} /> حفظ (أرشفة الاستمارة)
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-10 text-gray-500 bg-gray-50 dark:bg-slate-900/30 rounded-xl border border-dashed border-gray-300 dark:border-slate-700">
                    لا توجد طلبات معتمدة بانتظار المعالجة
                </div>
            )}
        </div>
    );
}
