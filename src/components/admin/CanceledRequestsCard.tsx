import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, XCircle, User, Archive, ChevronDown, ChevronUp, CheckCircle2, Printer } from 'lucide-react';
import type { LeaveRecord } from './AdminLeaveRequests';
import { LeaveTypeBadge } from './LeaveTypeBadge';

interface CanceledRequestsCardProps {
    records: LeaveRecord[];
    isLoading: boolean;
    onRefresh: () => void;
    activeHighlightId: string | null;
    isExpanded: boolean;
    onToggle: () => void;
    onPrint: (record: LeaveRecord) => void;
}

export function CanceledRequestsCard({
    records,
    isLoading,
    onRefresh,
    activeHighlightId,
    isExpanded,
    onToggle,
    onPrint
}: CanceledRequestsCardProps) {
    const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);

    return (
        <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-md rounded-3xl p-6 shadow-xl border border-gray-100 dark:border-slate-700 animate-in fade-in duration-500 relative">
            <div className="absolute top-0 right-0 w-2 h-full bg-red-500 rounded-r-3xl"></div>
            <button
                onClick={onToggle}
                className="w-full flex justify-between items-center mb-6 sticky top-20 z-20 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-gray-100/50 dark:border-slate-700/50 focus:outline-none"
            >
                <div className="flex-1 text-right">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <XCircle className="text-red-500" />
                        طلبات الإجازة الملغاة
                        {records.length > 0 && (
                            <span className="bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 text-xs font-bold px-2 py-0.5 rounded-full mr-2">
                                {records.length}
                            </span>
                        )}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1 text-right">
                        جميع الطلبات التي تم إلغاؤها بانتظار أرشفة الاستمارة
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
                        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-red-500" size={28} /></div>
                    ) : records.length > 0 ? (
                        <div className="flex flex-col gap-3">
                            {records.map(record => {
                                const nameParts = record.employee_name ? record.employee_name.split(' ').slice(0, 2).join(' ') : 'غير معروف';
                                const isItemExpanded = expandedRequestId === record.id;
                                const typeLabel = record.leave_type === 'long_regular' ? 'اعتيادية طويلة' : record.leave_type === 'long_sick' ? 'مرضية طويلة' : record.leave_type === 'sick' ? 'مرضية' : record.leave_type === 'regular' ? 'اعتيادية' : record.leave_type === 'time_off' ? 'زمنية' : '';
                                
                                return (
                                    <div 
                                        key={record.id} 
                                        id={`request-${record.id}`}
                                        className={`bg-white dark:bg-slate-900 border rounded-xl overflow-hidden transition-all duration-300 shadow-sm hover:shadow-md ${isItemExpanded ? 'border-red-200 dark:border-red-800 ring-1 ring-red-500/20' : 'border-gray-200 dark:border-slate-700 cursor-pointer'} ${record.id === activeHighlightId ? 'highlight-request' : ''}`}
                                    >
                                        {/* Thin Bar (Collapsed View) */}
                                        <div 
                                            onClick={() => setExpandedRequestId(isItemExpanded ? null : record.id)}
                                            className={`flex items-center justify-between p-3 ${isItemExpanded ? 'bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700/50' : 'cursor-pointer'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                                                    <User size={16} className="text-red-600 dark:text-red-400" />
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-bold text-sm">{nameParts}</span>
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100 dark:bg-red-900/20 dark:border-red-800/50">إجازة ملغاة {typeLabel ? `(${typeLabel})` : ''}</span>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs px-2 py-1 rounded-md bg-green-100 text-green-700 font-bold flex items-center gap-1 border border-green-200">
                                                    <CheckCircle2 size={12} /> معتمدة
                                                </span>
                                            </div>
                                        </div>

                                        {/* Expanded Content */}
                                        {isItemExpanded && (
                                            <div className="p-4 animate-in slide-in-from-top-2 duration-200 bg-gray-50/50 dark:bg-slate-900/50">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                                            <User size={20} className="text-red-600 dark:text-red-400" />
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-base">{record.employee_name}</div>
                                                            <div className="text-sm text-muted-foreground">{record.employee_job_number}</div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-3 mb-5 bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-100 dark:border-slate-700">
                                                    <div className="text-sm">
                                                        <span className="text-muted-foreground">من </span>
                                                        <span className="font-bold">{record.start_date}</span>
                                                        <span className="text-muted-foreground"> إلى </span>
                                                        <span className="font-bold">{record.end_date}</span>
                                                    </div>
                                                    <div className="text-sm">
                                                        <span className="text-muted-foreground">المدة: </span>
                                                        <span className="font-bold">{record.days_count} يوم</span>
                                                        <span className="text-muted-foreground mx-2">|</span>
                                                        <span className="text-muted-foreground">المسؤول: </span>
                                                        <span className="font-bold">{record.supervisor?.full_name || 'غير محدد'}</span>
                                                    </div>
                                                    {record.cancellation_status === 'approved' && (
                                                        <div className="mt-2">
                                                            <LeaveTypeBadge type={record.leave_type} cancellationStatus={record.cancellation_status} />
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                <div className="pt-2 flex flex-col md:flex-row gap-2">
                                                    <button
                                                        onClick={() => onPrint(record)}
                                                        className="flex-1 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-3 rounded-xl text-sm font-bold transition flex justify-center items-center gap-2 shadow-sm"
                                                    >
                                                        <Printer size={18} /> طباعة
                                                    </button>
                                                    <button
                                                        onClick={async () => {
                                                            if (window.confirm('هل أنت متأكد من حفظ (أرشفة) هذه الإجازة لتختفي من القائمة؟')) {
                                                                const { error } = await supabase.from('leave_requests').update({ is_archived: true }).eq('id', record.id);
                                                                if (!error) {
                                                                    await supabase.from('leave_requests').update({ is_read_by_hr: true }).eq('id', record.id);
                                                                    onRefresh();
                                                                } else {
                                                                    alert("حدث خطأ أثناء أرشفة الإجازة.");
                                                                }
                                                            }
                                                        }}
                                                        className="flex-1 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-3 rounded-xl text-sm font-bold transition flex justify-center items-center gap-2 shadow-sm"
                                                    >
                                                        <Archive size={18} /> حفظ وأرشفة الإجازة الملغاة
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
                            لا توجد طلبات إجازة ملغاة بانتظار الأرشفة
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
